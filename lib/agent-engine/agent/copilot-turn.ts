/**
 * Turno do Copilot — job próprio, sem tools, sem send_message.
 * NÃO entra em CONVERSATIONAL_TURN_KINDS: o humano assumir não cancela
 * a sugestão (TESTE 12); o que não pode existir é side effect.
 */
import { z } from "zod";
import type pg from "pg";

import { lerPoliticaPg } from "@/lib/ai/execucao/ler-camadas";
import { carregarOverlayDoFunilPadrao } from "@/lib/ai/copiloto/overlay";
import { gerarSugestaoDoCopiloto } from "@/lib/ai/copiloto/gerar";
import type { JobRow } from "@/lib/agent-engine/queue/queue";
import type { LlmEdgeConfig } from "@/lib/agent-engine/edge/llm/run-model-call";
import { runModelCall } from "@/lib/agent-engine/edge/llm/run-model-call";
import type { Logger } from "@/lib/agent-engine/obs/logger";

export const copilotTurnPayloadSchema = z.object({
  conversation_id: z.string().uuid(),
  contact_id: z.string().uuid(),
  channel_session_id: z.string().uuid().optional(),
  inbound_message_id: z.string().uuid(),
  force: z.boolean().optional(),
});

export interface CopilotTurnDeps {
  log: Logger;
  llmCfg: LlmEdgeConfig;
}

export function createCopilotTurnHandler(deps: CopilotTurnDeps) {
  return async function handleCopilotTurn(job: JobRow, pool: pg.Pool): Promise<void> {
    const payload = copilotTurnPayloadSchema.parse(job.payload);
    const politica = await lerPoliticaPg(pool, {
      organizationId: job.organization_id,
      conversationId: payload.conversation_id,
      contactId: payload.contact_id,
      channelSessionId: payload.channel_session_id ?? null,
    });

    if (!politica.suggestion_allowed) {
      deps.log.info("copilot_turn: pulado — sugestão não permitida", {
        job_id: job.id,
        organization_id: job.organization_id,
        reason: politica.reason,
      });
      return;
    }

    const { rows: mensagens } = await pool.query<{ direction: string; body: string | null }>(
      `select direction, body from messages
        where organization_id = $1 and conversation_id = $2
        order by created_at asc
        limit 80`,
      [job.organization_id, payload.conversation_id],
    );

    const overlay = await carregarOverlayDoFunilPadrao(pool, job.organization_id);
    const result = await gerarSugestaoDoCopiloto({
      db: pool,
      organizationId: job.organization_id,
      conversationId: payload.conversation_id,
      contactId: payload.contact_id,
      inboundMessageId: payload.inbound_message_id,
      historico: mensagens,
      politica,
      overlay,
      force: payload.force === true,
      llm: async ({ historico, system }) => {
        const { result: call, model, usage } = await runModelCall(pool, deps.llmCfg, {
          tenantId: job.organization_id,
          leadId: payload.contact_id,
          jobId: job.id,
          purpose: "copilot_suggestion",
          system,
          messages: historico
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
      deps.log.warn("copilot_turn: não gerou sugestão", {
        job_id: job.id,
        organization_id: job.organization_id,
        reason: result.reason,
      });
      return;
    }
    deps.log.info("copilot_turn: sugestão pronta", {
      job_id: job.id,
      organization_id: job.organization_id,
      conversation_id: payload.conversation_id,
      deduped: result.deduped,
    });
  };
}
