/**
 * Confirmação humana de uma ação CONTROLLED.
 * Executa uma vez; confirmação duplicada devolve o mesmo resultado.
 */
import type { Queryable } from "@/lib/agent-engine/queue/queue";
import { registrarAcaoDeIa } from "./auditar";
import { authorizeAiAction, type AiAction } from "./autorizar";
import {
  buscarPedido,
  marcarPedidoExecutado,
  type PedidoDeAcaoRow,
} from "./pedidos";
import type { AiMode } from "@/lib/schemas/settings";

export type ExecutorDeAcao = (pedido: PedidoDeAcaoRow) => Promise<Record<string, unknown>>;

export type ResultadoDaConfirmacao =
  | { ok: true; pedido: PedidoDeAcaoRow; idempotent: boolean }
  | { ok: false; reason: "not_found" | "denied" | "failed"; message: string };

export async function confirmarPedidoDeAcao(input: {
  db: Queryable;
  organizationId: string;
  pedidoId: string;
  userId: string;
  aiMode: AiMode;
  executar: ExecutorDeAcao;
}): Promise<ResultadoDaConfirmacao> {
  const pedido = await buscarPedido(input.db, input.organizationId, input.pedidoId);
  if (!pedido) {
    return { ok: false, reason: "not_found", message: "Pedido não encontrado." };
  }

  if (pedido.status === "executed") {
    registrarAcaoDeIa({
      organization_id: input.organizationId,
      conversation_id: pedido.conversation_id,
      agent_id: pedido.agent_id,
      mode: input.aiMode,
      requested_action: pedido.requested_action,
      policy_result: pedido.policy_result,
      confirmed_by: input.userId,
      executed_by: pedido.executed_by,
      result: "idempotent",
    });
    return { ok: true, pedido, idempotent: true };
  }

  if (pedido.status !== "pending") {
    return { ok: false, reason: "denied", message: `Pedido em estado ${pedido.status}.` };
  }

  const decisao = authorizeAiAction({
    action: pedido.requested_action as AiAction,
    ai_mode: input.aiMode,
    configured: { confirm: [pedido.requested_action as AiAction] },
  });
  if (decisao.verdict === "DENY") {
    return { ok: false, reason: "denied", message: decisao.reason };
  }

  let resultado: Record<string, unknown>;
  try {
    resultado = await input.executar(pedido);
  } catch (err) {
    registrarAcaoDeIa({
      organization_id: input.organizationId,
      conversation_id: pedido.conversation_id,
      agent_id: pedido.agent_id,
      mode: input.aiMode,
      requested_action: pedido.requested_action,
      policy_result: pedido.policy_result,
      confirmed_by: input.userId,
      executed_by: input.userId,
      result: "failed",
    });
    return {
      ok: false,
      reason: "failed",
      message: err instanceof Error ? err.message : "falha ao executar",
    };
  }

  const gravado = await marcarPedidoExecutado(input.db, {
    organizationId: input.organizationId,
    id: pedido.id,
    userId: input.userId,
    result: resultado,
  });
  if (!gravado) {
    const deNovo = await buscarPedido(input.db, input.organizationId, input.pedidoId);
    if (deNovo?.status === "executed") {
      return { ok: true, pedido: deNovo, idempotent: true };
    }
    return { ok: false, reason: "failed", message: "Não consegui gravar a confirmação." };
  }

  registrarAcaoDeIa({
    organization_id: input.organizationId,
    conversation_id: pedido.conversation_id,
    agent_id: pedido.agent_id,
    mode: input.aiMode,
    requested_action: pedido.requested_action,
    policy_result: pedido.policy_result,
    confirmed_by: input.userId,
    executed_by: input.userId,
    result: "executed",
  });
  return { ok: true, pedido: gravado, idempotent: false };
}
