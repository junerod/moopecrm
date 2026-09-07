/**
 * O que um fluxo de follow-up PRECISA para enrollar e avançar.
 *
 * O gate de agente publicado (`agent-followup-gate.ts`) nasceu porque o
 * follow-up era uma capacidade do AGENTE: `ai_classify`, `ai_message` e
 * espera `smart` pedem LLM/persona. Um fluxo só de trigger + template + end
 * não é decisão de IA — é automação determinística. Exigir agente ali
 * deixava o toggle do Simple Mode inerte com AI_MODE=off.
 *
 * Classificação é do GRAFO, nunca do Ready Model id nem do ai_mode.
 */
import type { FlowGraph, FlowNode } from "./graph-schema";

export type FluxoPublicado = {
  triggerNodeId: string;
  graph: FlowGraph;
};

export function fluxoPublicadoDoGrafo(graph: FlowGraph): FluxoPublicado | null {
  const triggerNodeId = graph.nodes.find((n) => n.type === "trigger")?.id;
  if (!triggerNodeId) return null;
  return { triggerNodeId, graph };
}

export function fluxoRequerIa(graph: FlowGraph): boolean {
  return graph.nodes.some(noRequerIa);
}

function noRequerIa(node: FlowNode): boolean {
  if (node.type === "ai_classify") return true;
  if (node.type === "wait" && node.config.mode === "smart") return true;
  if (node.type === "action" && node.config.mode === "ai_message") return true;
  return false;
}

/**
 * Decide se o gatilho automático pode criar enrollment.
 * `agentId` é o pin opcional (persona/fila). Fluxo com IA sem agente = recusa.
 * Fluxo determinístico sem agente = libera, agent_id fica null.
 */
export function decidirArmacaoAutomatica(
  graph: FlowGraph | null,
  agentId: string | null,
): { allowed: boolean; agentId: string | null; requiresAi: boolean } {
  if (!graph) return { allowed: false, agentId: null, requiresAi: true };
  const requiresAi = fluxoRequerIa(graph);
  if (requiresAi) {
    return { allowed: agentId !== null, agentId, requiresAi: true };
  }
  return { allowed: true, agentId, requiresAi: false };
}
