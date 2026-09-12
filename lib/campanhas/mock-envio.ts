/**
 * Envio MOCK de campanha — mesma doutrina do alerta interno do Bloco 2.
 *
 * Não chama adapter, não cria conversation/message, não muda owner/AI_MODE,
 * não gera QR. Prova destinatário, template, classificação e opt-out.
 */
import { CLASSIFICACAO_CAMPANHA } from "@/lib/campanhas/tipos";

export interface PedidoDeEnvioMock {
  campaignId: string;
  contactId: string;
  destE164: string;
  body: string;
  templateId?: string | null;
  provider?: string | null;
}

export interface EntregaMock {
  via: "mock";
  classificacao: typeof CLASSIFICACAO_CAMPANHA;
  campaign_id: string;
  contact_id: string;
  dest_e164: string;
  body: string;
  template_id: string | null;
  provider: string | null;
}

export function enviarCampanhaMock(pedido: PedidoDeEnvioMock): EntregaMock {
  return {
    via: "mock",
    classificacao: CLASSIFICACAO_CAMPANHA,
    campaign_id: pedido.campaignId,
    contact_id: pedido.contactId,
    dest_e164: pedido.destE164,
    body: pedido.body,
    template_id: pedido.templateId ?? null,
    provider: pedido.provider ?? null,
  };
}
