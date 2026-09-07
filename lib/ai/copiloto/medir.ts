import { logger } from "@/lib/logger";

export interface MedicaoDoCopiloto {
  organization_id: string;
  conversation_id: string;
  agent_id?: string | null;
  model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  inbound_message_id?: string | null;
  deduped?: boolean;
  force?: boolean;
}

export function registrarExecucaoDoCopiloto(m: MedicaoDoCopiloto): void {
  logger.info("ai.copilot", {
    organization_id: m.organization_id,
    conversation_id: m.conversation_id,
    agent_id: m.agent_id ?? null,
    model: m.model ?? null,
    prompt_tokens: m.prompt_tokens ?? null,
    completion_tokens: m.completion_tokens ?? null,
    inbound_message_id: m.inbound_message_id ?? null,
    deduped: m.deduped ?? false,
    force: m.force ?? false,
    timestamp: new Date().toISOString(),
  });
}
