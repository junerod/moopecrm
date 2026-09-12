/**
 * Intenção do envio — NÃO se infere de `actor.type`.
 *
 * `webhook_source` é amplo demais: automação, MOOPE e webhooks genéricos
 * compartilham o mesmo actor. Só `send_intent` explícito libera a exceção
 * operacional da MOOPE.
 */
import type { HandlerCtx } from "@/lib/api/handlers/types";

export const INTENCOES_DE_ENVIO = [
  "human",
  "conversational_auto",
  "operational_moope",
  "integration_api",
  "system_notice",
  "campaign_commercial",
] as const;

export type IntencaoDeEnvio = (typeof INTENCOES_DE_ENVIO)[number];

export function resolverIntencaoDeEnvio(ctx: Pick<HandlerCtx, "actor" | "send_intent">): IntencaoDeEnvio {
  if (ctx.send_intent) return ctx.send_intent;
  if (ctx.actor.type === "user") return "human";
  // Qualquer outro ator — inclusive webhook_source — é conversacional
  // até alguém declarar o contrário. A MOOPE operacional SETA o campo.
  return "conversational_auto";
}

/** Estes caminhos passam por `decidirEnvioConversacional`. */
export function envioRespeitaComandoDaConversa(intent: IntencaoDeEnvio): boolean {
  return intent === "conversational_auto" || intent === "integration_api";
}

export function ehEnvioOperacionalMoope(intent: IntencaoDeEnvio): boolean {
  return intent === "operational_moope";
}

export function ehEnvioCampanhaComercial(intent: IntencaoDeEnvio): boolean {
  return intent === "campaign_commercial";
}
