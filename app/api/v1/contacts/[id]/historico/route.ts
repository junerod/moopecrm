/**
 * POST /api/v1/contacts/:id/historico — importa o fio DESTE contato.
 *
 * A Central só traz a lista. O inbox só recebe conversa quando alguém
 * pede aqui, no dossiê — senão o ambiente enche de assunto que nunca
 * vira atendimento.
 *
 * organization_id vem da sessão autenticada. Nunca do path/body.
 * Agent+.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { iniciarImportacaoDaConversa } from "@/lib/channels/historico";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await params;

  const authz = await requireRole("agent", {
    requestId,
    resource: "contacts",
  });
  if (!authz.ok) return authz.response;

  const r = await iniciarImportacaoDaConversa(authz.org.orgId, id);
  if (!r.ok) {
    const status =
      r.codigo === "nao_encontrado"
        ? 404
        : r.codigo === "nao_conectado"
          ? 422
          : r.codigo === "sem_transporte"
            ? 503
            : 502;
    const code =
      r.codigo === "nao_encontrado"
        ? "not_found"
        : r.codigo === "nao_conectado"
          ? "invalid_state_transition"
          : r.codigo === "sem_transporte"
            ? "unavailable"
            : "upstream_unavailable";
    return fail(code, r.mensagem, status, { requestId });
  }
  return ok(
    {
      mensagens: r.mensagens,
      ja_existiam: r.ja_existiam,
      lidas: r.lidas,
      conversation_id: r.conversation_id,
    },
    { requestId },
  );
}
