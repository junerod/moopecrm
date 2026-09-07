/**
 * Observabilidade da Etapa 2 — sem dashboard.
 * Campos mínimos: org, conversa, agente, modo, decisão, kill, job, cancelado, motivo.
 */
import { logger } from "@/lib/logger";
import type { AiMode } from "./modos";
import type { KillSource } from "./politica";

export interface MedicaoDeExecucao {
  organization_id: string;
  conversation_id?: string | null;
  agent_id?: string | null;
  ai_mode?: AiMode;
  execution_decision: "allow" | "deny" | "skip_dispatch" | "invalidated" | "abort";
  kill_source?: KillSource | null;
  job_id?: string | null;
  cancelled?: number;
  reason: string;
}

export function registrarDecisaoDeExecucao(medicao: MedicaoDeExecucao): void {
  logger.info("ai.execucao", {
    organization_id: medicao.organization_id,
    conversation_id: medicao.conversation_id ?? null,
    agent_id: medicao.agent_id ?? null,
    ai_mode: medicao.ai_mode ?? null,
    execution_decision: medicao.execution_decision,
    kill_source: medicao.kill_source ?? null,
    job_id: medicao.job_id ?? null,
    cancelled: medicao.cancelled ?? 0,
    reason: medicao.reason,
    timestamp: new Date().toISOString(),
  });
}
