/**
 * GET  — última sugestão do Copilot desta conversa.
 * POST — gera (ou regenera) uma sugestão. Nunca envia mensagem.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { carregarOverlayDoFunilPadrao } from "@/lib/ai/copiloto/overlay";
import { gerarSugestaoDoCopiloto } from "@/lib/ai/copiloto/gerar";
import { buscarSugestaoAtual, marcarSugestao } from "@/lib/ai/copiloto/persistir";
import { faixaDeConfianca, rotuloDaIntencao } from "@/lib/ai/copiloto/schema";
import { lerPoliticaPg } from "@/lib/ai/execucao/ler-camadas";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { llmEdgeConfigFromEnv } from "@/lib/agent-engine/edge/llm/run-model-call";
import { runModelCall } from "@/lib/agent-engine/edge/llm/run-model-call";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  op: z.enum(["use", "discard"]),
  suggestion_id: z.string().uuid(),
});

function dto(row: Awaited<ReturnType<typeof buscarSugestaoAtual>>) {
  if (!row) return null;
  return {
    id: row.id,
    inbound_message_id: row.inbound_message_id,
    summary: row.summary,
    intent: row.intent,
    intent_label: rotuloDaIntencao(row.intent),
    suggested_reply: row.suggested_reply,
    suggested_next_action: row.suggested_next_action,
    extracted_fields: row.extracted_fields,
    confidence: Number(row.confidence),
    confidence_band: faixaDeConfianca(Number(row.confidence)),
    status: row.status,
  };
}

async function carregarConversa(orgId: string, conversationId: string) {
  const supabase = await createClient();
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, organization_id, contact_id, channel_session_id")
    .eq("id", conversationId)
    .eq("organization_id", orgId)
    .maybeSingle();
  return conv;
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  const conv = await carregarConversa(authz.org.orgId, id);
  if (!conv) return fail("not_found", "Conversa não encontrada.", 404, { requestId });

  let pool;
  try {
    pool = getRequestPool();
  } catch {
    return fail("unavailable", "Copiloto indisponível (config).", 503, { requestId });
  }

  const row = await buscarSugestaoAtual(pool, {
    organizationId: authz.org.orgId,
    conversationId: conv.id,
  });
  return ok({ suggestion: dto(row) }, { requestId });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  const conv = await carregarConversa(authz.org.orgId, id);
  if (!conv) return fail("not_found", "Conversa não encontrada.", 404, { requestId });

  let force = false;
  try {
    const body = (await req.json()) as { force?: unknown };
    force = body.force === true;
  } catch {
    force = false;
  }

  let pool;
  try {
    pool = getRequestPool();
  } catch {
    return fail("unavailable", "Copiloto indisponível (config).", 503, { requestId });
  }

  const politica = await lerPoliticaPg(pool, {
    organizationId: authz.org.orgId,
    conversationId: conv.id,
    contactId: conv.contact_id,
    channelSessionId: conv.channel_session_id,
  });
  if (!politica.suggestion_allowed) {
    return fail("forbidden", politica.reason, 403, { requestId });
  }

  const { rows: inbound } = await pool.query<{ id: string }>(
    `select id from messages
      where organization_id = $1 and conversation_id = $2 and direction = 'inbound'
      order by created_at desc limit 1`,
    [authz.org.orgId, conv.id],
  );
  const inboundId = inbound[0]?.id;
  if (!inboundId) {
    return fail("unprocessable", "Não há mensagem do cliente para analisar.", 422, { requestId });
  }

  const { rows: historico } = await pool.query<{ direction: string; body: string | null }>(
    `select direction, body from messages
      where organization_id = $1 and conversation_id = $2
      order by created_at asc limit 80`,
    [authz.org.orgId, conv.id],
  );

  const llmCfg = llmEdgeConfigFromEnv(env);
  const overlay = await carregarOverlayDoFunilPadrao(pool, authz.org.orgId);
  const result = await gerarSugestaoDoCopiloto({
    db: pool,
    organizationId: authz.org.orgId,
    conversationId: conv.id,
    contactId: conv.contact_id,
    inboundMessageId: inboundId,
    historico,
    politica,
    overlay,
    force,
    llm: async ({ historico: msgs, system }) => {
      const { result: call, model, usage } = await runModelCall(pool, llmCfg, {
        tenantId: authz.org.orgId,
        leadId: conv.contact_id ?? undefined,
        jobId: null,
        purpose: "copilot_suggestion",
        system,
        messages: msgs
          .filter((m) => (m.body ?? "").trim().length > 0)
          .map((m) => ({
            role: m.direction === "inbound" ? ("user" as const) : ("assistant" as const),
            content: m.body ?? "",
          })),
      });
      return {
        texto: call.text ?? "",
        model,
        prompt_tokens: usage.inputTokens,
        completion_tokens: usage.outputTokens,
      };
    },
  });

  if (!result.ok) {
    const status = result.reason === "mode_off" ? 403 : result.reason === "empty" ? 422 : 500;
    return fail("unprocessable", result.message, status, { requestId });
  }
  return ok({ suggestion: dto(result.suggestion), deduped: result.deduped }, { requestId });
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  const conv = await carregarConversa(authz.org.orgId, id);
  if (!conv) return fail("not_found", "Conversa não encontrada.", 404, { requestId });

  const body = patchSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return fail("validation_failed", "op e suggestion_id são obrigatórios.", 422, { requestId });
  }

  let pool;
  try {
    pool = getRequestPool();
  } catch {
    return fail("unavailable", "Copiloto indisponível (config).", 503, { requestId });
  }

  const row = await marcarSugestao(pool, {
    organizationId: authz.org.orgId,
    suggestionId: body.data.suggestion_id,
    status: body.data.op === "use" ? "used" : "discarded",
  });
  if (!row || row.conversation_id !== conv.id) {
    return fail("not_found", "Sugestão não encontrada.", 404, { requestId });
  }
  return ok({ suggestion: dto(row) }, { requestId });
}
