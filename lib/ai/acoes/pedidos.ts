import type { Queryable } from "@/lib/agent-engine/queue/queue";
import type { AiAction, VeredictoDeAcao } from "./autorizar";

export type StatusDoPedido = "pending" | "confirmed" | "denied" | "executed" | "failed";

export interface PedidoDeAcaoRow {
  id: string;
  organization_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  agent_id: string | null;
  requested_action: AiAction;
  payload: Record<string, unknown>;
  policy_result: VeredictoDeAcao;
  status: StatusDoPedido;
  idempotency_key: string;
  confirmed_by: string | null;
  executed_by: string | null;
  result: Record<string, unknown> | null;
}

export async function criarPedidoDeAcao(
  db: Queryable,
  input: {
    organizationId: string;
    conversationId?: string | null;
    contactId?: string | null;
    leadId?: string | null;
    agentId?: string | null;
    action: AiAction;
    payload: Record<string, unknown>;
    policyResult: VeredictoDeAcao;
    idempotencyKey: string;
  },
): Promise<{ row: PedidoDeAcaoRow; created: boolean }> {
  const { rows } = await db.query<PedidoDeAcaoRow>(
    `insert into ai_action_requests (
       organization_id, conversation_id, contact_id, lead_id, agent_id,
       requested_action, payload, policy_result, status, idempotency_key
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9)
     on conflict (organization_id, idempotency_key)
     do nothing
     returning id, organization_id, conversation_id, contact_id, lead_id, agent_id,
               requested_action, payload, policy_result, status, idempotency_key,
               confirmed_by, executed_by, result`,
    [
      input.organizationId,
      input.conversationId ?? null,
      input.contactId ?? null,
      input.leadId ?? null,
      input.agentId ?? null,
      input.action,
      JSON.stringify(input.payload),
      input.policyResult,
      input.idempotencyKey,
    ],
  );
  if (rows[0]) return { row: rows[0], created: true };
  const existente = await buscarPedidoPorChave(db, input.organizationId, input.idempotencyKey);
  if (!existente) throw new Error("pedido conflitante não encontrado");
  return { row: existente, created: false };
}

export async function buscarPedidoPorChave(
  db: Queryable,
  organizationId: string,
  idempotencyKey: string,
): Promise<PedidoDeAcaoRow | null> {
  const { rows } = await db.query<PedidoDeAcaoRow>(
    `select id, organization_id, conversation_id, contact_id, lead_id, agent_id,
            requested_action, payload, policy_result, status, idempotency_key,
            confirmed_by, executed_by, result
       from ai_action_requests
      where organization_id = $1 and idempotency_key = $2`,
    [organizationId, idempotencyKey],
  );
  return rows[0] ?? null;
}

export async function buscarPedido(
  db: Queryable,
  organizationId: string,
  id: string,
): Promise<PedidoDeAcaoRow | null> {
  const { rows } = await db.query<PedidoDeAcaoRow>(
    `select id, organization_id, conversation_id, contact_id, lead_id, agent_id,
            requested_action, payload, policy_result, status, idempotency_key,
            confirmed_by, executed_by, result
       from ai_action_requests
      where organization_id = $1 and id = $2`,
    [organizationId, id],
  );
  return rows[0] ?? null;
}

export async function listarPedidosPendentes(
  db: Queryable,
  ids: { organizationId: string; conversationId: string },
): Promise<PedidoDeAcaoRow[]> {
  const { rows } = await db.query<PedidoDeAcaoRow>(
    `select id, organization_id, conversation_id, contact_id, lead_id, agent_id,
            requested_action, payload, policy_result, status, idempotency_key,
            confirmed_by, executed_by, result
       from ai_action_requests
      where organization_id = $1 and conversation_id = $2 and status = 'pending'
      order by created_at desc`,
    [ids.organizationId, ids.conversationId],
  );
  return rows;
}

export async function marcarPedidoExecutado(
  db: Queryable,
  input: {
    organizationId: string;
    id: string;
    userId: string;
    result: Record<string, unknown>;
  },
): Promise<PedidoDeAcaoRow | null> {
  const { rows } = await db.query<PedidoDeAcaoRow>(
    `update ai_action_requests
        set status = 'executed',
            confirmed_by = coalesce(confirmed_by, $3),
            executed_by = $3,
            result = $4,
            updated_at = now()
      where organization_id = $1 and id = $2 and status in ('pending', 'executed')
      returning id, organization_id, conversation_id, contact_id, lead_id, agent_id,
                requested_action, payload, policy_result, status, idempotency_key,
                confirmed_by, executed_by, result`,
    [input.organizationId, input.id, input.userId, JSON.stringify(input.result)],
  );
  return rows[0] ?? null;
}
