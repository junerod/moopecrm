/**
 * Quem PODE disparar campanha comercial de verdade.
 *
 * WAHA (QR) tem banRisk e freeform — não habilitar envio comercial real.
 * Meta / Zernio / Twilio exigem template oficial fora da janela.
 * Nesta rodada o worker é MOCK; a UI ainda reflete esta matriz.
 */
import {
  CHANNEL_PROVIDER_META,
  CHANNEL_PROVIDER_TWILIO,
  CHANNEL_PROVIDER_WAHA,
  CHANNEL_PROVIDER_ZERNIO,
  capabilitiesOf,
} from "@/lib/channels/capabilities";
import type { ChannelProvider } from "@/lib/channels/types";

export function campanhaComercialRealPermitida(provider: ChannelProvider): boolean {
  if (provider === CHANNEL_PROVIDER_WAHA) return false;
  const caps = capabilitiesOf(provider);
  return caps.requiresTemplates && !caps.banRisk;
}

export function campanhaExigeTemplateOficial(provider: ChannelProvider): boolean {
  return capabilitiesOf(provider).requiresTemplates;
}

export function rotuloDaCapability(provider: ChannelProvider): string {
  if (provider === CHANNEL_PROVIDER_WAHA) {
    return "WhatsApp por QR não dispara campanha comercial real.";
  }
  if (provider === CHANNEL_PROVIDER_META || provider === CHANNEL_PROVIDER_ZERNIO) {
    return "Canal oficial: use template aprovado. Envio desta rodada é simulado.";
  }
  if (provider === CHANNEL_PROVIDER_TWILIO) {
    return "Twilio: template do provedor. Envio desta rodada é simulado.";
  }
  return "Provider sem campanha comercial habilitada.";
}
