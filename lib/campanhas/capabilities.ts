/**
 * Quem PODE disparar campanha comercial em massa no canal oficial.
 *
 * Canal com risco de banimento (QR) continua falso aqui — o disparo
 * daquele número é outro caminho: só no fio que já existe.
 * Canal oficial exige template aprovado fora da janela.
 */
import { capabilitiesOf } from "@/lib/channels/capabilities";
import type { ChannelProvider } from "@/lib/channels/types";

export function campanhaComercialRealPermitida(provider: ChannelProvider): boolean {
  const caps = capabilitiesOf(provider);
  return caps.requiresTemplates && !caps.banRisk;
}

export function campanhaExigeTemplateOficial(provider: ChannelProvider): boolean {
  return capabilitiesOf(provider).requiresTemplates;
}

export function rotuloDaCapability(provider: ChannelProvider): string {
  const caps = capabilitiesOf(provider);
  if (caps.banRisk) {
    return "Neste número a campanha só chega em quem já tem conversa aberta.";
  }
  if (caps.requiresTemplates) {
    return "Canal oficial: use template aprovado.";
  }
  return "Este canal não dispara campanha comercial.";
}
