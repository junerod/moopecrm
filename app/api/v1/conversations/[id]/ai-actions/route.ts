/**
 * GET  — pedidos de ação pendentes desta conversa.
 * POST — pede autorização (CONTROLLED). Sem policy explícita, ação importante
 *        não executa: DENY ou REQUIRE_CONFIRMATION.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { authorizeAiAction, ehAcaoConhecida, lerActionPolicy } from "@/lib/ai/acoes/autorizar";
import { registrarAcaoDeIa } from "@/lib/ai/acoes/auditar";
import { criarPedidoDeAcao, listarPedidosPendentes } from "@/lib/ai/acoes/pedidos";
import { lerAiMode } from "@/lib/ai/execucao/modos";
import { lerPoliticaPg } from "@/lib/ai/execucao/ler-camadas";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  action: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  idempotency_key: z.string().min(8).max(120),
});

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!conv) return fail("not_found", "Conversa não encontrada.", 404, { requestId });

  let pool;
  try {
    pool = getRequestPool();
  } catch {
    return fail("unavailable", "Action policy indisponível (config).", 503, { requestId });
  }

  const rows = await listarPedidosPendentes(pool, {
    organizationId: authz.org.orgId,
    conversationId: conv.id,
  });
  return ok({ requests: rows }, { requestId });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "action e idempotency_key são obrigatórios.", 422, { requestId });
  }
  if (!ehAcaoConhecida(parsed.data.action)) {
    return fail("validation_failed", "Ação desconhecida.", 422, { requestId });
  }

  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, contact_id, channel_session_id")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!conv) return fail("not_found", "Conversa não encontrada.", 404, { requestId });

  let pool;
  try {
    pool = getRequestPool();
  } catch {
    return fail("unavailable", "Action policy indisponível (config).", 503, { requestId });
  }

  const { rows: orgRows } = await pool.query<{ settings: Record<string, unknown> | null }>(
    `select settings from organizations where id = $1`,
    [authz.org.orgId],
  );
  const settings = orgRows[0]?.settings ?? {};
  const aiMode = lerAiMode(settings.ai_mode);
  const configured = lerActionPolicy(settings.ai_action_policy);
  const execution = await lerPoliticaPg(pool, {
    organizationId: authz.org.orgId,
    conversationId: conv.id,
    contactId: conv.contact_id,
    channelSessionId: conv.channel_session_id,
  });

  const decisao = authorizeAiAction({
    action: parsed.data.action,
    ai_mode: aiMode,
    execution,
    configured,
  });

  registrarAcaoDeIa({
    organization_id: authz.org.orgId,
    conversation_id: conv.id,
    mode: aiMode,
    requested_action: parsed.data.action,
    policy_result: decisao.verdict,
    result: "requested",
  });

  if (decisao.verdict === "DENY") {
    return ok({ verdict: decisao.verdict, reason: decisao.reason, request: null }, { requestId });
  }

  if (decisao.verdict === "REQUIRE_CONFIRMATION" || decisao.verdict === "REQUIRE_HUMAN") {
    const { row } = await criarPedidoDeAcao(pool, {
      organizationId: authz.org.orgId,
      conversationId: conv.id,
      contactId: conv.contact_id,
      leadId: typeof parsed.data.payload.lead_id === "string" ? parsed.data.payload.lead_id : null,
      action: parsed.data.action,
      payload: parsed.data.payload,
      policyResult: decisao.verdict,
      idempotencyKey: parsed.data.idempotency_key,
    });
    return ok({ verdict: decisao.verdict, reason: decisao.reason, request: row }, { requestId });
  }

  return ok({ verdict: decisao.verdict, reason: decisao.reason, request: null }, { requestId });
}
