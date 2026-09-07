/**
 * Modo de IA — a pergunta B, distinta do comando da conversa.
 *
 * Comando (Etapa 1): quem manda? automático / humano / pausado / encerrado / bloqueado.
 * Modo (Etapa 2): mesmo com o automático autorizado, O QUE a IA pode fazer?
 *
 * CONTROLLED colapsa para COPILOT nas capacidades de envio/mutação.
 * A Action Policy (`authorizeAiAction`) é o módulo que decide efeito
 * em CONTROLLED — este arquivo não autoriza side effect por ausência.
 */
import { aiModeSchema, type AiMode } from "@/lib/schemas/settings";

export { AI_MODES, AI_MODE_PADRAO_ORG_NOVA, aiModeSchema, type AiMode } from "@/lib/schemas/settings";

export type ModoEfetivo = "off" | "copilot" | "autonomous";

export interface CapacidadesDoModo {
  podeChamarLlm: boolean;
  podeSugerir: boolean;
  podeEnviar: boolean;
  podeMutarCrm: boolean;
  podeChamarToolExterna: boolean;
  podeTomarComando: boolean;
}

const CAPACIDADE_OFF: CapacidadesDoModo = {
  podeChamarLlm: false,
  podeSugerir: false,
  podeEnviar: false,
  podeMutarCrm: false,
  podeChamarToolExterna: false,
  podeTomarComando: false,
};

const CAPACIDADE_COPILOT: CapacidadesDoModo = {
  podeChamarLlm: true,
  podeSugerir: true,
  podeEnviar: false,
  podeMutarCrm: false,
  podeChamarToolExterna: false,
  podeTomarComando: false,
};

const CAPACIDADE_AUTONOMOUS: CapacidadesDoModo = {
  podeChamarLlm: true,
  podeSugerir: true,
  podeEnviar: true,
  podeMutarCrm: true,
  podeChamarToolExterna: true,
  podeTomarComando: true,
};

export function lerAiMode(valor: unknown): AiMode {
  return aiModeSchema.parse(valor);
}

export function modoEfetivo(mode: AiMode): ModoEfetivo {
  if (mode === "off") return "off";
  if (mode === "autonomous") return "autonomous";
  // copilot e controlled (sem policy engine) — só sugestão.
  return "copilot";
}

export function capacidadesDoModo(mode: AiMode): CapacidadesDoModo {
  const efetivo = modoEfetivo(mode);
  if (efetivo === "off") return CAPACIDADE_OFF;
  if (efetivo === "autonomous") return CAPACIDADE_AUTONOMOUS;
  return CAPACIDADE_COPILOT;
}

export type PedidoDeEfeitoDaIa =
  | { tipo: "sugerir_resposta" | "sugerir_acao" | "classificar" | "extrair" | "resumir" }
  | { tipo: "send_message" }
  | { tipo: "mover_lead" }
  | { tipo: "chamar_tool_externa" }
  | { tipo: "alterar_dado_critico" }
  | { tipo: "tomar_comando" };

export type DecisaoDeEfeitoDaIa =
  | { permitido: true; eh_sugestao: true; sugestao: { tipo: string; lado: "copiloto" } }
  | { permitido: false; codigo: "DENY"; motivo: string };

/**
 * Superfície semântica do COPILOT: lê/sugere; qualquer side effect é DENY.
 * AUTONOMOUS libera o pedido (o comando da conversa e os kills ainda mandam
 * por cima — esta função só responde o modo).
 */
export function decidirEfeitoDaIa(mode: AiMode, pedido: PedidoDeEfeitoDaIa): DecisaoDeEfeitoDaIa {
  const caps = capacidadesDoModo(mode);
  if (
    pedido.tipo === "sugerir_resposta" ||
    pedido.tipo === "sugerir_acao" ||
    pedido.tipo === "classificar" ||
    pedido.tipo === "extrair" ||
    pedido.tipo === "resumir"
  ) {
    if (!caps.podeSugerir) {
      return { permitido: false, codigo: "DENY", motivo: `AI_MODE=${mode} não gera sugestão.` };
    }
    return { permitido: true, eh_sugestao: true, sugestao: { tipo: pedido.tipo, lado: "copiloto" } };
  }
  if (pedido.tipo === "send_message" && !caps.podeEnviar) {
    return { permitido: false, codigo: "DENY", motivo: `AI_MODE=${mode} não envia mensagem.` };
  }
  if (pedido.tipo === "mover_lead" && !caps.podeMutarCrm) {
    return { permitido: false, codigo: "DENY", motivo: `AI_MODE=${mode} não move lead sozinho.` };
  }
  if (pedido.tipo === "chamar_tool_externa" && !caps.podeChamarToolExterna) {
    return { permitido: false, codigo: "DENY", motivo: `AI_MODE=${mode} não chama ferramenta externa.` };
  }
  if (pedido.tipo === "alterar_dado_critico" && !caps.podeMutarCrm) {
    return { permitido: false, codigo: "DENY", motivo: `AI_MODE=${mode} não altera dado crítico.` };
  }
  if (pedido.tipo === "tomar_comando" && !caps.podeTomarComando) {
    return { permitido: false, codigo: "DENY", motivo: `AI_MODE=${mode} não toma o comando da conversa.` };
  }
  if (!caps.podeEnviar && !caps.podeMutarCrm) {
    return { permitido: false, codigo: "DENY", motivo: `AI_MODE=${mode} não produz side effect.` };
  }
  return { permitido: true, eh_sugestao: true, sugestao: { tipo: pedido.tipo, lado: "copiloto" } };
}
