/**
 * A FACE do canal na conversa — o que o operador vê, não o motor.
 *
 * WhatsApp hoje chega por mais de um transporte. Direct é outra FACE, e ainda
 * não tem transporte. Colapsar os dois num rótulo só ("mensagem") faria a
 * Inbox mentir no dia em que o Direct nascer: toda linha continuaria parecendo
 * a mesma coisa.
 *
 * Provider nenhum sai daqui. Quem pergunta "posso mandar texto livre?" usa
 * `capabilities`. Quem pergunta "que selo pinto na conversa?" usa isto.
 */
import type { ChannelProvider } from "./types";

export const ESPECIES_DO_CANAL = ["whatsapp", "direct"] as const;
export type EspecieDoCanal = (typeof ESPECIES_DO_CANAL)[number];

const ROTULO: Record<EspecieDoCanal, string> = {
  whatsapp: "WhatsApp",
  direct: "Direct",
};

/** Todo transporte que existe hoje fala WhatsApp. Direct entra quando tiver adapter. */
const ESPECIE_POR_PROVIDER: Record<ChannelProvider, EspecieDoCanal> = {
  waha: "whatsapp",
  meta_cloud: "whatsapp",
  zernio: "whatsapp",
  twilio: "whatsapp",
};

export function rotuloDaEspecie(especie: EspecieDoCanal): string {
  return ROTULO[especie];
}

export function especieDoProvider(provider: string | null | undefined): EspecieDoCanal | null {
  if (!provider) return null;
  const especie = ESPECIE_POR_PROVIDER[provider as ChannelProvider];
  return especie ?? null;
}
