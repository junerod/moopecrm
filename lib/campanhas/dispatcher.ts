/**
 * Dispatcher por canal. MOCK nunca grava conversation/message.
 * REAL só chama adapter quando a via do diagnóstico é `real`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { acharFioExistenteParaCampanha, registrarOutboundDaCampanha } from "@/lib/campanhas/conversa";
import { viaDoEmail, viaDoWhatsapp, type ViaDoCanal } from "@/lib/campanhas/diagnostico";
import { montarEnvelopeDeEmail } from "@/lib/campanhas/email-envelope";
import { enviarCampanhaMock } from "@/lib/campanhas/mock-envio";
import { CLASSIFICACAO_CAMPANHA, type CanalDaCampanha } from "@/lib/campanhas/tipos";
import {
  campanhaQrExigeConversaExistente,
  enviarWhatsappDaCampanha,
} from "@/lib/channels/campaign-send";
import {
  CHANNEL_SESSION_REF_COLUMNS,
  resolveSessionRef,
  type ChannelSessionRef,
} from "@/lib/channels/session-ref";
import type { ChannelProvider } from "@/lib/channels/types";
import { sendEmail } from "@/lib/email/resend";

export interface PedidoDeDispatch {
  organizationId: string;
  campaignId: string;
  campaignName: string;
  contactId: string;
  canal: CanalDaCampanha;
  destination: string;
  body: string;
  provider: ChannelProvider | null;
  sessionRef: string | null;
  templateId?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  mediaUrl?: string | null;
  mediaKind?: "image" | "video" | "document" | null;
  mediaFilename?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  rodape: {
    nome: string;
    telefone?: string | null;
    email?: string | null;
    endereco?: string | null;
  };
  logoUrl?: string | null;
  accentHex?: string | null;
  modo: "auto" | "mock" | "real";
  adapterConfigured?: boolean;
  channelSessionId?: string | null;
  waLid?: string | null;
  waIdentity?: string | null;
}

export interface ResultadoDeDispatch {
  via: ViaDoCanal;
  classificacao: typeof CLASSIFICACAO_CAMPANHA;
  status: "sent" | "failed" | "skipped";
  reason?: string;
  messageId?: string | null;
  externalId?: string | null;
}

export async function dispatchRecipient(
  db: SupabaseClient,
  pedido: PedidoDeDispatch,
): Promise<ResultadoDeDispatch> {
  if (pedido.canal === "whatsapp") {
    return dispatchWhatsapp(db, pedido);
  }
  return dispatchEmail(db, pedido);
}

async function dispatchWhatsapp(
  db: SupabaseClient,
  pedido: PedidoDeDispatch,
): Promise<ResultadoDeDispatch> {
  const via = viaDoWhatsapp({
    modo: pedido.modo,
    provider: pedido.provider,
    templateId: pedido.templateId ?? pedido.templateName,
    adapterConfigured: pedido.adapterConfigured,
  });

  if (via === "mock") {
    enviarCampanhaMock({
      campaignId: pedido.campaignId,
      contactId: pedido.contactId,
      destE164: pedido.destination,
      body: pedido.body,
      templateId: pedido.templateId,
      provider: pedido.provider,
    });
    return { via, classificacao: CLASSIFICACAO_CAMPANHA, status: "sent" };
  }

  if (via === "indisponivel" || !pedido.provider) {
    return {
      via: "indisponivel",
      classificacao: CLASSIFICACAO_CAMPANHA,
      status: "failed",
      reason: "provider_indisponivel",
    };
  }

  const qr = campanhaQrExigeConversaExistente(pedido.provider);
  let sessionId = pedido.channelSessionId ?? null;
  let conversationId: string | null = null;
  if (qr) {
    const fio = await acharFioExistenteParaCampanha(db, {
      organizationId: pedido.organizationId,
      contactId: pedido.contactId,
      channelSessionId: pedido.channelSessionId,
    });
    if (!fio) {
      return {
        via: "real",
        classificacao: CLASSIFICACAO_CAMPANHA,
        status: "skipped",
        reason: "sem_conversa_no_numero",
      };
    }
    conversationId = fio.conversationId;
    sessionId = fio.sessionId;
  }

  const sessionRef =
    (sessionId ? await refDaSessao(db, pedido.organizationId, sessionId) : null) ??
    pedido.sessionRef;
  if (!sessionRef) {
    return {
      via: "indisponivel",
      classificacao: CLASSIFICACAO_CAMPANHA,
      status: "failed",
      reason: "provider_indisponivel",
    };
  }

  const r = await enviarWhatsappDaCampanha(db, {
    organizationId: pedido.organizationId,
    provider: pedido.provider,
    sessionRef,
    to: pedido.destination,
    body: pedido.body,
    templateName: pedido.templateName,
    templateLanguage: pedido.templateLanguage,
    media: pedido.mediaUrl
      ? {
          url: pedido.mediaUrl,
          filename: pedido.mediaFilename ?? undefined,
          kind: pedido.mediaKind ?? "image",
        }
      : null,
    somenteConversaExistente: qr,
    waLid: pedido.waLid,
    waIdentity: pedido.waIdentity,
  });

  if (!r.ok) {
    return {
      via: "real",
      classificacao: CLASSIFICACAO_CAMPANHA,
      status: "failed",
      reason: r.reason,
    };
  }

  const messageId = await registrarOutboundDaCampanha(db, {
    organizationId: pedido.organizationId,
    contactId: pedido.contactId,
    campaignId: pedido.campaignId,
    body: pedido.body,
    destination: pedido.destination,
    externalId: r.externalId,
    mediaPath: null,
    channelSessionId: sessionId,
    conversationId,
  });

  return {
    via: "real",
    classificacao: CLASSIFICACAO_CAMPANHA,
    status: "sent",
    messageId,
    externalId: r.externalId,
  };
}

async function dispatchEmail(
  db: SupabaseClient,
  pedido: PedidoDeDispatch,
): Promise<ResultadoDeDispatch> {
  const via = viaDoEmail({ modo: pedido.modo });

  if (via === "mock") {
    enviarCampanhaMock({
      campaignId: pedido.campaignId,
      contactId: pedido.contactId,
      destE164: pedido.destination,
      body: pedido.body,
      templateId: pedido.templateId,
      provider: "email",
    });
    return { via, classificacao: CLASSIFICACAO_CAMPANHA, status: "sent" };
  }

  if (via === "indisponivel") {
    return {
      via: "indisponivel",
      classificacao: CLASSIFICACAO_CAMPANHA,
      status: "failed",
      reason: "email_nao_configurado",
    };
  }

  const envelope = montarEnvelopeDeEmail({
    nomeCampanha: pedido.campaignName,
    corpo: pedido.body,
    rodape: pedido.rodape,
    logoUrl: pedido.logoUrl,
    ctaUrl: pedido.ctaUrl,
    ctaLabel: pedido.ctaLabel,
    midiaUrl: pedido.mediaUrl,
    midiaKind: pedido.mediaKind,
    accentHex: pedido.accentHex,
  });

  const r = await sendEmail({
    to: pedido.destination,
    subject: envelope.subject,
    html: envelope.html,
    text: envelope.text,
    fromName: pedido.rodape.nome,
    tags: [
      { name: "campaign_id", value: pedido.campaignId },
      { name: "classification", value: CLASSIFICACAO_CAMPANHA },
    ],
  });

  if (!r.ok) {
    return {
      via: "real",
      classificacao: CLASSIFICACAO_CAMPANHA,
      status: "failed",
      reason: r.error ?? "send_failed",
    };
  }

  return {
    via: "real",
    classificacao: CLASSIFICACAO_CAMPANHA,
    status: "sent",
    externalId: r.id ?? null,
  };
}

async function refDaSessao(
  db: SupabaseClient,
  organizationId: string,
  sessionId: string,
): Promise<string | null> {
  const { data } = await db
    .from("channel_sessions")
    .select(`id, ${CHANNEL_SESSION_REF_COLUMNS}`)
    .eq("id", sessionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!data) return null;
  try {
    const ref = resolveSessionRef(data as ChannelSessionRef);
    return ref?.trim() ? ref : null;
  } catch {
    return null;
  }
}
