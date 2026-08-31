/**
 * POST /api/v1/integrations/moope/events
 *
 * Cadastro → CRM. Bearer da chave de entrada. Idempotente por external_id.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { processarEventoInbound } from "@/lib/moope/eventos-inbound";
import { MOOPE_INBOUND_TYPES } from "@/lib/moope/tipos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  type: z.enum(MOOPE_INBOUND_TYPES),
  external_id: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()).default({}),
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

  const resultado = await processarEventoInbound(
    admin,
    conexao.organization_id,
    conexao.id,
    conexao.kind,
    body.type,
    body.external_id,
    { ...body.payload, external_id: body.payload.external_id ?? body.external_id },
  );
  if (!resultado.ok) {
    return fail("internal_error", resultado.motivo ?? "falha ao processar", 500, { requestId });
  }

  if (!resultado.duplicado) {
    await audit({
      action: "moope.event_received",
      organizationId: conexao.organization_id,
      resourceType: "moope_inbound_event",
      requestId,
      metadata: {
        type: body.type,
        contact_id: resultado.contact_id ?? null,
        lead_id: resultado.lead_id ?? null,
      },
    });
  }

  return ok(
    {
      ...resultado,
      request_id: requestId,
    },
    { requestId },
  );
}
