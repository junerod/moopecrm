import { logger } from "@/lib/logger";
import type { AiMode } from "@/lib/schemas/settings";
import type { VeredictoDeAcao } from "./autorizar";

export interface AuditoriaDeAcao {
  organization_id: string;
  conversation_id?: string | null;
  agent_id?: string | null;
  mode: AiMode;
  requested_action: string;
  policy_result: VeredictoDeAcao;
  confirmed_by?: string | null;
  executed_by?: string | null;
  result: string;
}

export function registrarAcaoDeIa(a: AuditoriaDeAcao): void {
  logger.info("ai.action", {
    organization_id: a.organization_id,
    conversation_id: a.conversation_id ?? null,
    agent_id: a.agent_id ?? null,
    mode: a.mode,
    requested_action: a.requested_action,
    policy_result: a.policy_result,
    confirmed_by: a.confirmed_by ?? null,
    executed_by: a.executed_by ?? null,
    result: a.result,
    timestamp: new Date().toISOString(),
  });
}
