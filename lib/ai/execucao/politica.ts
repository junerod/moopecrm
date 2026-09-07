/**
 * Resolvedor ÚNICO da política de execução de IA.
 *
 * Hierarquia (o primeiro OFF vence):
 *   GLOBAL → TENANT → CHANNEL → AGENT → CONVERSATION
 *
 * Não é o comando da conversa. O comando (`decidirEnvioConversacional`)
 * entra aqui só como a camada CONVERSATION — um kill, não um modo.
 *
 * CONTROLLED colapsa para COPILOT em `modos.ts` para envio/mutação
 * (não herda AUTONOMOUS). A Action Policy (`authorizeAiAction`) lê
 * `ai_mode` configurado, não este colapso.
 */
import {
  capacidadesDoModo,
  lerAiMode,
  modoEfetivo,
  type AiMode,
  type CapacidadesDoModo,
  type ModoEfetivo,
} from "./modos";

export type KillSource = "global" | "tenant" | "channel" | "agent" | "conversation";

export interface CamadasDaPolitica {
  globalOff: boolean;
  tenantMode: AiMode;
  channelOff: boolean;
  agentOff: boolean;
  conversationDeny: { codigo: string; motivo: string } | null;
}

export interface AiExecutionPolicy {
  ai_mode: AiMode;
  modo_efetivo: ModoEfetivo;
  execution_allowed: boolean;
  side_effects_allowed: boolean;
  deve_enfileirar_turno: boolean;
  /** COPILOT/CONTROLLED: a IA pode produzir sugestão (sem side effect). */
  suggestion_allowed: boolean;
  /** Enfileira `copilot_turn`, nunca `inbound_turn`. */
  deve_enfileirar_copiloto: boolean;
  kill_source: KillSource | null;
  reason: string;
  capabilities: CapacidadesDoModo;
}

export function resolveAiExecutionPolicy(camadas: CamadasDaPolitica): AiExecutionPolicy {
  const ai_mode = lerAiMode(camadas.tenantMode);
  const caps = capacidadesDoModo(ai_mode);
  const efetivo = modoEfetivo(ai_mode);

  if (camadas.globalOff) {
    return fechar(ai_mode, efetivo, caps, "global", "GLOBAL AI_EXECUTION=off — nenhuma IA conversacional executa.");
  }
  if (efetivo === "off") {
    return fechar(ai_mode, efetivo, caps, "tenant", "AI_MODE=off nesta organização — IA conversacional desligada.");
  }
  if (camadas.channelOff) {
    return fechar(ai_mode, efetivo, caps, "channel", "IA desligada neste canal.");
  }
  if (camadas.agentOff) {
    return fechar(ai_mode, efetivo, caps, "agent", "este agente está pausado ou sem versão publicada.");
  }
  if (camadas.conversationDeny) {
    // Humano no comando NÃO mata o Copilot: a sugestão é para o atendente.
    // Kill de conversa só cala o turno autônomo (Etapa 1 intacta).
    if (modoDeSugestao(ai_mode) && caps.podeSugerir) {
      return {
        ai_mode,
        modo_efetivo: efetivo,
        execution_allowed: false,
        side_effects_allowed: false,
        deve_enfileirar_turno: false,
        suggestion_allowed: true,
        deve_enfileirar_copiloto: true,
        kill_source: "conversation",
        reason: camadas.conversationDeny.motivo,
        capabilities: caps,
      };
    }
    return fechar(ai_mode, efetivo, caps, "conversation", camadas.conversationDeny.motivo);
  }

  const side = caps.podeEnviar;
  const sugere = modoDeSugestao(ai_mode) && caps.podeSugerir;
  return {
    ai_mode,
    modo_efetivo: efetivo,
    execution_allowed: caps.podeChamarLlm,
    side_effects_allowed: side,
    // COPILOT/CONTROLLED: inbound_turn não envia — o job certo é copilot_turn.
    deve_enfileirar_turno: efetivo === "autonomous" && side,
    suggestion_allowed: caps.podeSugerir,
    deve_enfileirar_copiloto: sugere,
    kill_source: null,
    reason: efetivo === "autonomous" ? "AUTONOMOUS autorizado — ainda sujeito ao comando da conversa." : "COPILOT — só sugestão, sem side effect.",
    capabilities: caps,
  };
}

function modoDeSugestao(mode: AiMode): boolean {
  return mode === "copilot" || mode === "controlled";
}

/** O que a UI mostra como "efetivo": kill acima da conversa vira OFF. */
export function modoApresentado(p: Pick<AiExecutionPolicy, "ai_mode" | "kill_source" | "suggestion_allowed">): AiMode {
  if (p.kill_source === "global" || p.kill_source === "tenant" || p.kill_source === "channel" || p.kill_source === "agent") {
    return "off";
  }
  if (p.kill_source === "conversation" && !p.suggestion_allowed) {
    return "off";
  }
  return p.ai_mode;
}

function fechar(
  ai_mode: AiMode,
  modo_efetivo: ModoEfetivo,
  capabilities: CapacidadesDoModo,
  kill_source: KillSource,
  reason: string,
): AiExecutionPolicy {
  return {
    ai_mode,
    modo_efetivo,
    execution_allowed: false,
    side_effects_allowed: false,
    deve_enfileirar_turno: false,
    suggestion_allowed: false,
    deve_enfileirar_copiloto: false,
    kill_source,
    reason,
    capabilities,
  };
}

/**
 * Grafia do kill global. Mesmo contrato de `AI_BUDGET_ENFORCEMENT`:
 * string, nunca enum no boot. Lixo cai em ligado (não derruba a VPS).
 */
export function globalAiExecutionOff(valor: string | undefined = process.env.AI_EXECUTION): boolean {
  const v = (valor ?? "on").trim().toLowerCase();
  return v === "off" || v === "false" || v === "0" || v === "no" || v === "nao" || v === "não" || v === "disabled";
}

export function canalEmOff(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const modo = (metadata as { ai_mode?: unknown }).ai_mode;
  return typeof modo === "string" && modo.trim().toLowerCase() === "off";
}
