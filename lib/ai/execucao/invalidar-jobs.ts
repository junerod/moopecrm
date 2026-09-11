/**
 * Invalida jobs conversacionais de uma conversa/contato quando o humano
 * assume, pausa ou toma o comando.
 *
 * pending → failed (terminal, não ressuscita).
 * running → marca abort_requested no last_error, SEM roubar o lease.
 *   O turno relê a marca e o last-second gate da Etapa 1 continua de pé.
 *
 * Devolver para o automático NÃO reabre estes jobs. Inbound novo gera
 * evento novo, job novo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ABORT_REQUESTED_PREFIX,
  CONVERSATIONAL_TURN_KINDS,
  invalidatePendingConversationalJobs,
  jobFoiInvalidado,
  requestAbortOnRunningConversationalJobs,
  type Queryable,
} from "@/lib/agent-engine/queue/queue";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarDecisaoDeExecucao } from "./medir";

export { jobFoiInvalidado, ABORT_REQUESTED_PREFIX };

export const MOTIVO_ABORT_TAKEOVER = `${ABORT_REQUESTED_PREFIX}human_takeover`;

export interface AlvoDeInvalidacao {
  organizationId: string;
  contactId: string | null;
  conversationId: string;
  reason?: string;
}

export interface ResultadoDeInvalidacao {
  pending: number;
  running: number;
}

export async function invalidarJobsConversacionaisPg(
  db: Queryable,
  alvo: AlvoDeInvalidacao,
): Promise<ResultadoDeInvalidacao> {
  if (!alvo.contactId) return { pending: 0, running: 0 };
  const reason = alvo.reason ?? MOTIVO_ABORT_TAKEOVER;
  const pending = await invalidatePendingConversationalJobs(db, {
    organizationId: alvo.organizationId,
    contactId: alvo.contactId,
    reason,
  });
  const running = await requestAbortOnRunningConversationalJobs(db, {
    organizationId: alvo.organizationId,
    contactId: alvo.contactId,
    reason,
  });
  registrarDecisaoDeExecucao({
    organization_id: alvo.organizationId,
    conversation_id: alvo.conversationId,
    execution_decision: "invalidated",
    cancelled: pending + running,
    reason,
  });
  return { pending, running };
}

/**
 * Variante Inbox / rotas cookie. Sempre usa service role + filtro de org —
 * o client da sessão em geral não escreve em `job_queue`.
 * Nunca lança: invalidar é otimização; o gate da Etapa 1 é a defesa.
 */
export async function invalidarJobsConversacionaisSupabase(
  alvo: AlvoDeInvalidacao,
  admin?: SupabaseClient,
): Promise<ResultadoDeInvalidacao> {
  if (!alvo.contactId) return { pending: 0, running: 0 };
  const reason = alvo.reason ?? MOTIVO_ABORT_TAKEOVER;
  try {
    // createAdminClient() NÃO pode ser default-arg: o default avalia ANTES
    // do try, e um throw ali vira 500 no POST /messages (o claim do envio
    // humano não pode derrubar a mensagem).
    const client = admin ?? createAdminClient();
    const pending = await marcarPendentes(client, alvo, reason);
    const running = await marcarRunning(client, alvo, reason);
    registrarDecisaoDeExecucao({
      organization_id: alvo.organizationId,
      conversation_id: alvo.conversationId,
      execution_decision: "invalidated",
      cancelled: pending + running,
      reason,
    });
    return { pending, running };
  } catch (err) {
    logger.warn("[ai.execucao] invalidação de jobs falhou — o gate de envio segue de pé", {
      organization_id: alvo.organizationId,
      conversation_id: alvo.conversationId,
      detail: err instanceof Error ? err.message.slice(0, 160) : "desconhecido",
    });
    return { pending: 0, running: 0 };
  }
}

async function marcarPendentes(
  admin: SupabaseClient,
  alvo: AlvoDeInvalidacao,
  reason: string,
): Promise<number> {
  if (!alvo.contactId) return 0;
  const { data, error } = await admin
    .from("job_queue")
    .update({ status: "failed", last_error: reason, locked_by: null, locked_at: null } as never)
    .eq("organization_id", alvo.organizationId)
    .eq("contact_id", alvo.contactId)
    .eq("status", "pending")
    .in("kind", [...CONVERSATIONAL_TURN_KINDS])
    .select("id");
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}

async function marcarRunning(
  admin: SupabaseClient,
  alvo: AlvoDeInvalidacao,
  reason: string,
): Promise<number> {
  if (!alvo.contactId) return 0;
  const { data, error } = await admin
    .from("job_queue")
    .update({ last_error: reason } as never)
    .eq("organization_id", alvo.organizationId)
    .eq("contact_id", alvo.contactId)
    .eq("status", "running")
    .in("kind", [...CONVERSATIONAL_TURN_KINDS])
    .select("id");
  if (error) throw error;
  return Array.isArray(data) ? data.length : 0;
}
