/**
 * GET  /api/v1/channel-sessions/:id/historico — progresso do sync da lista.
 * POST /api/v1/channel-sessions/:id/historico — traz CONTATOS que já
 *      estavam no aparelho. O fio não entra no inbox aqui: isso é
 *      POST /contacts/:id/historico, no dossiê de quem for atender.
 *
 * organization_id vem da sessão autenticada. Nunca do path/body.
 * GET: qualquer membro. POST: admin.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { requireRole } from "@/lib/auth/require-role";
import {
  iniciarHistoricoDoCanal,
  lerHistoricoDoCanal,
} from "@/lib/channels/historico";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function httpDaFalha(codigo: string): number {
  if (codigo === "nao_encontrado") return 404;
  if (codigo === "arquivado") return 409;
  if (codigo === "sem_sessao") return 422;
  if (codigo === "nao_conectado") return 422;
  if (codigo === "em_andamento") return 409;
  if (codigo === "sem_transporte") return 503;
  return 502;
}

function codigoDaApi(codigo: string): Parameters<typeof fail>[0] {
  if (codigo === "nao_encontrado") return "not_found";
  if (codigo === "arquivado") return "channel_archived";
  if (codigo === "sem_sessao") return "channel_without_session";
  if (codigo === "nao_conectado") return "invalid_state_transition";
  if (codigo === "em_andamento") return "state_conflict";
  if (codigo === "sem_transporte") return "unavailable";
  return "upstream_unavailable";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await params;

  const user = await loadAuthUser();
  if (!user) return fail("unauthenticated", "Auth required.", 401, { requestId });
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) return fail("forbidden_tenant", "Nenhuma organização ativa.", 403, { requestId });

  const leitura = await lerHistoricoDoCanal(activeOrg.orgId, id);
  if (!leitura.ok) {
    return fail(codigoDaApi(leitura.codigo), leitura.mensagem, httpDaFalha(leitura.codigo), {
      requestId,
    });
  }
  return ok(
    { historico: leitura.progresso, channel_status: leitura.statusDoCanal },
    { requestId },
  );
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await params;

  const authz = await requireRole("admin", {
    requestId,
    resource: "channel_sessions",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const inicio = await iniciarHistoricoDoCanal(activeOrg.orgId, id);
  if (!inicio.ok) {
    return fail(codigoDaApi(inicio.codigo), inicio.mensagem, httpDaFalha(inicio.codigo), {
      requestId,
    });
  }
  return ok({ historico: inicio.progresso }, { requestId });
}
