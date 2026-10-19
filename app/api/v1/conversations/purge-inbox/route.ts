/**
 * POST /api/v1/conversations/purge-inbox
 *
 * Só o admin da empresa. Apaga fila, caixa e histórico de conversa.
 * Contatos e cards do funil ficam.
 * Corpo: { "confirm": "LIMPAR" }.
 *
 * Service role porque o apagamento atravessa mensagens, notas e casos por
 * cascade — e a mídia entra na fila de remoção, que o papel da sessão não
 * escreve. O organization_id sai da sessão (`requireRole`), nunca do corpo.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { limparCaixa } from "@/lib/inbox/limpar-caixa";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ confirm: z.string() }).strict();

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", {
    requestId,
    resource: "conversations",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("invalid_request", "Corpo não é JSON válido.", 400, { requestId });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("validation_failed", "Digite LIMPAR para limpar a caixa de entrada.", 422, {
      requestId,
    });
  }

  try {
    const resultado = await limparCaixa(
      createAdminClient(),
      authz.org.orgId,
      parsed.data.confirm,
      requestId,
    );
    await audit({
      action: "conversation.inbox_purged",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "conversation",
      resourceId: authz.org.orgId,
      requestId,
      metadata: {
        apagadas: resultado.apagadas,
        acompanhamentos: resultado.acompanhamentos,
        midias: resultado.midias,
        avisos: resultado.avisos,
      },
    });
    return ok(resultado, { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não consegui limpar a caixa de entrada.";
    const status = message.includes("LIMPAR") ? 422 : 500;
    return fail(status === 422 ? "validation_failed" : "internal_error", message, status, {
      requestId,
    });
  }
}
