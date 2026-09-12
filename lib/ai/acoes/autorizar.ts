/**
 * Action Policy — a pergunta C, distinta das outras duas.
 *
 *   A. Comando da conversa (`decidirEnvioConversacional`) — quem pode falar?
 *   B. AI execution policy (`resolveAiExecutionPolicy`) — a IA pode trabalhar?
 *   C. Esta função — qual EFEITO a IA está autorizada a produzir?
 *
 * Não é prompt. Ausência de regra nunca vira ALLOW.
 */
import {
  AI_ACTIONS,
  aiActionPolicySchema,
  type AiAction,
  type AiActionPolicyConfig,
  type AiMode,
} from "@/lib/schemas/settings";
import type { AiExecutionPolicy } from "@/lib/ai/execucao/politica";

export type { AiAction, AiActionPolicyConfig };

export const VEREDICTOS_DE_ACAO = [
  "ALLOW",
  "DENY",
  "REQUIRE_CONFIRMATION",
  "REQUIRE_HUMAN",
] as const;
export type VeredictoDeAcao = (typeof VEREDICTOS_DE_ACAO)[number];

export interface PedidoDeAutorizacao {
  action: AiAction;
  /** Modo configurado do tenant (não o modo_efetivo colapsado). */
  ai_mode: AiMode;
  /** Política de execução já resolvida (kills). Opcional nos testes puros. */
  execution?: Pick<
    AiExecutionPolicy,
    "suggestion_allowed" | "execution_allowed" | "side_effects_allowed" | "kill_source"
  >;
  configured?: Partial<AiActionPolicyConfig> | null;
}

export interface DecisaoDeAcao {
  verdict: VeredictoDeAcao;
  action: AiAction;
  reason: string;
}

const LEITURA_OU_SUGESTAO = new Set<AiAction>([
  "read_conversation",
  "read_contact",
  "read_lead",
  "search_knowledge",
  "suggest_reply",
  "summarize",
  "classify_intent",
  "extract_fields",
]);

const LEVES_REVERSIVEIS = new Set<AiAction>(["add_tag", "create_task"]);

const IMPORTANTES = new Set<AiAction>([
  "move_lead_stage",
  "send_message",
  "call_external_api",
  "operational_moope_action",
]);

/** Default CONTROLLED: mover lead pede confirmação; o resto importante é DENY. */
const CONFIRM_PADRAO_CONTROLLED = new Set<AiAction>(["move_lead_stage"]);

export function lerActionPolicy(valor: unknown): AiActionPolicyConfig {
  return aiActionPolicySchema.parse(valor ?? {});
}

export function ehAcaoConhecida(valor: string): valor is AiAction {
  return (AI_ACTIONS as readonly string[]).includes(valor);
}

export function authorizeAiAction(pedido: PedidoDeAutorizacao): DecisaoDeAcao {
  const action = pedido.action;
  const allow = new Set(pedido.configured?.allow ?? []);
  const confirm = new Set(pedido.configured?.confirm ?? []);
  const exec = pedido.execution;
  const killMataTudo =
    exec?.kill_source === "global" ||
    exec?.kill_source === "tenant" ||
    exec?.kill_source === "channel" ||
    exec?.kill_source === "agent";

  if (killMataTudo || pedido.ai_mode === "off") {
    return deny(action, `AI_MODE=${pedido.ai_mode} — nenhuma ação de IA.`);
  }

  // Campanha comercial é massa. COPILOT e AUTONOMOUS não disparam nesta rodada
  // mesmo se a policy genérica listar a ação. CONTROLLED só prepara + confirma.
  if (action === "campaign_dispatch") {
    if (pedido.ai_mode === "controlled") {
      return confirmVerdict(action, "Campanha comercial exige confirmação humana.");
    }
    return deny(action, "Campanha comercial não dispara por IA nesta rodada.");
  }

  if (LEITURA_OU_SUGESTAO.has(action)) {
    if (exec && !exec.suggestion_allowed && !exec.execution_allowed) {
      return deny(action, "IA sem permissão de leitura/sugestão neste contexto.");
    }
    return allowVerdict(action, "leitura/sugestão autorizada pelo modo.");
  }

  if (pedido.ai_mode === "copilot") {
    return deny(action, "COPILOT não produz side effect.");
  }

  if (pedido.ai_mode === "controlled") {
    if (allow.has(action)) {
      return allowVerdict(action, "CONTROLLED: ação na allowlist explícita.");
    }
    if (confirm.has(action)) {
      return confirmVerdict(action, "CONTROLLED: exige confirmação humana.");
    }
    if (LEVES_REVERSIVEIS.has(action)) {
      return deny(action, "CONTROLLED: ação leve sem autorização explícita.");
    }
    if (IMPORTANTES.has(action) && CONFIRM_PADRAO_CONTROLLED.has(action)) {
      return confirmVerdict(action, "CONTROLLED: ação importante pede confirmação.");
    }
    if (IMPORTANTES.has(action)) {
      return deny(action, "CONTROLLED: ação importante sem policy explícita.");
    }
    return deny(action, "CONTROLLED: ausência de policy não é ALLOW.");
  }

  // AUTONOMOUS — ainda passa por modo/kill/comando/allowlist/guardrails no runtime.
  if (exec && !exec.side_effects_allowed && IMPORTANTES.has(action)) {
    return deny(action, "AUTONOMOUS sem side effect neste contexto (kill ou comando).");
  }
  return allowVerdict(action, "AUTONOMOUS: ação segue para guardrails e comando.");
}

function allowVerdict(action: AiAction, reason: string): DecisaoDeAcao {
  return { verdict: "ALLOW", action, reason };
}

function deny(action: AiAction, reason: string): DecisaoDeAcao {
  return { verdict: "DENY", action, reason };
}

function confirmVerdict(action: AiAction, reason: string): DecisaoDeAcao {
  return { verdict: "REQUIRE_CONFIRMATION", action, reason };
}
