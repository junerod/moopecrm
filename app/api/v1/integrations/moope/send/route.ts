/**
 * POST /api/v1/integrations/moope/send
 *
 * Um locatário, uma mensagem, no WhatsApp já pareado. Bearer mop_…
 * Canal com risco de ban: sem fio → 409. Canal com modelo: SID + variáveis.
 * Não acorda o agente. Sem array.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { enviarPeloCrm } from "@/lib/moope/enviar";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    external_id: z.string().min(1).max(200),
    phone: z.string().min(8).max(32),
    body: z.string().min(1).max(4096).optional(),
    template: z
      .object({
        name: z.string().min(1).max(512),
        language: z.string().min(2).max(16).optional(),
        values: z.record(z.string(), z.string()).optional(),
      })
      .optional(),
    idempotency_key: z.string().min(1).max(200),
  })
  .refine((d) => Boolean(d.body || d.template), {
    message: "Informe body ou template",
    path: ["body"],
  });

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  const conexao = await resolverConexaoPeloBearer(admin, req.headers.get("authorization"));
  if (!conexao) {
    return fail("unauthenticated", "Chave de integração inválida ou desligada.", 401, { requestId });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return fail("validation_failed", err instanceof Error ? err.message : "body inválido", 422, {
      requestId,
    });
  }

  const resultado = await enviarPeloCrm(admin, conexao.organization_id, body, requestId);
  if (!resultado.ok) {
    return fail(resultado.code, resultado.message, resultado.status, {
      requestId,
      headers: resultado.retry_after
        ? { "Retry-After": String(resultado.retry_after) }
        : undefined,
    });
  }

  if (!resultado.deduplicado) {
    await audit({
      action: "moope.message_sent",
      organizationId: conexao.organization_id,
      resourceType: "message",
      resourceId: resultado.message_id,
      requestId,
      metadata: {
        conversation_id: resultado.conversation_id,
        external_id: body.external_id,
      },
    });
  }

  return ok(
    {
      message_id: resultado.message_id,
      conversation_id: resultado.conversation_id,
      ...(resultado.deduplicado ? { duplicado: true } : {}),
    },
    { requestId },
  );
}
