/**
 * Quem PODE disparar campanha comercial de verdade.
 *
 * Canal com risco de banimento (QR) não habilita envio comercial.
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
    return "WhatsApp por QR não dispara campanha comercial real.";
  }
  if (caps.requiresTemplates) {
    return "Canal oficial: use template aprovado.";
  }
  return "Este canal não dispara campanha comercial.";
}
