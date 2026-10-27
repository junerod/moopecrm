import { logger } from "@/lib/logger";
import type { createAdminClient } from "@/lib/supabase/admin";

import { chamarAssessor } from "./cliente";
import { avisarPeloWhatsappDoCrm } from "./aviso-waha";
import {
  destinatariosDaQueda,
  destinatariosDaResposta,
  destinatariosDoAviso,
  deveAvisarQueda,
  deveAvisarResposta,
  ehFluxoComercialMoope,
  lerAssessorNasSettings,
  rotuloDaLinha,
} from "./config";

type Admin = ReturnType<typeof createAdminClient>;

async function emailsDaOrganizacao(admin: Admin, organizationId: string): Promise<string[]> {
  const { data } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", organizationId)
    .is("revoked_at", null);
  const ids = (data ?? [])
    .map((r) => r.user_id)
    .filter(Boolean)
    .slice(0, 40);
  const emails: string[] = [];
  for (const id of ids) {
    const { data: user } = await admin.auth.admin.getUserById(id);
    const email = user.user?.email?.trim().toLowerCase();
    if (email) emails.push(email);
  }
  return emails;
}

/**
 * Primeira mensagem de um cliente → WhatsApp de quem está no Meu Assessor.
 * No fluxo comercial@moope.com.br, Tatiana e o DEV recebem sempre, com a linha de entrada.
 * Nunca derruba a ingestão.
 */
export async function avisarAssessorSeClienteNovo(
  admin: Admin,
  entrada: {
    organizationId: string;
    contactId: string;
    conversationId: string;
    channelSessionId?: string;
    texto: string | null;
    nomeDoContato: string | null;
  },
): Promise<void> {
  try {
    const { count, error: countErr } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", entrada.organizationId)
      .eq("conversation_id", entrada.conversationId)
      .eq("direction", "inbound");
    if (countErr) {
      logger.warn("assessor: não contei as mensagens do cliente novo", {
        organization_id: entrada.organizationId,
        conversation_id: entrada.conversationId,
        detail: countErr.message.slice(0, 160),
      });
      return;
    }
    if (count !== 1) return;

    const { data: org } = await admin
      .from("organizations")
      .select("display_name, settings")
      .eq("id", entrada.organizationId)
      .maybeSingle();
    const cfg = lerAssessorNasSettings(org?.settings);
    const emails = await emailsDaOrganizacao(admin, entrada.organizationId);
    const fluxoComercial = ehFluxoComercialMoope(emails);
    const phones = destinatariosDoAviso({
      fluxoComercial,
      phones: cfg.contacts.filter((c) => c.leadEnabled).map((c) => c.phone),
    });
    if (!phones.length) return;

    let lineLabel: string | null = null;
    if (fluxoComercial && entrada.channelSessionId) {
      const { data: sessao } = await admin
        .from("channel_sessions")
        .select("phone_number")
        .eq("id", entrada.channelSessionId)
        .maybeSingle();
      const linha = rotuloDaLinha(sessao?.phone_number);
      lineLabel = linha ? `${linha.rotulo} · ${linha.display}` : null;
    }

    const { data: contato } = await admin
      .from("contacts")
      .select("display_name, name, phone_number")
      .eq("id", entrada.contactId)
      .maybeSingle();

    const nomeCliente =
      contato?.display_name || contato?.name || entrada.nomeDoContato || "Cliente";
    const foneCliente = contato?.phone_number || "";
    const sent = await chamarAssessor({
      action: "alert",
      phones,
      line_label: lineLabel,
      client_name: nomeCliente,
      client_phone: foneCliente || null,
      preview: (entrada.texto || "").slice(0, 180),
      organization: org?.display_name || "CRM",
      conversation_id: entrada.conversationId,
    }, 20000);
    const semJanela = new Set<string>();
    for (const r of sent.results || []) {
      if (!r.ok) semJanela.add(r.phone);
    }
    if (!sent.ok && semJanela.size === 0) {
      for (const p of phones) semJanela.add(p);
    }
    if (semJanela.size) {
      const texto = [
        "🔔 *Cliente novo no MOOPE CRM*",
        lineLabel ? `📥 Entrou pelo *${lineLabel}*` : null,
        `👤 *${nomeCliente}*${foneCliente ? ` · ${foneCliente}` : ""}`,
        (entrada.texto || "").trim()
          ? `💬 ${(entrada.texto || "").trim().slice(0, 180)}`
          : "💬 Mandou a primeira mensagem.",
        "Entre no MOOPE CRM e responda por lá.",
        "_Não precisa responder neste WhatsApp._",
      ]
        .filter((l): l is string => Boolean(l))
        .join("\n");
      await avisarPeloWhatsappDoCrm(admin, [...semJanela], texto);
    }
    if (!sent.ok) {
      logger.warn("assessor: aviso de cliente novo não saiu", {
        organization_id: entrada.organizationId,
        conversation_id: entrada.conversationId,
        error: sent.error,
        phones: phones.length,
      });
    }
  } catch (err) {
    logger.warn("assessor: aviso de cliente novo falhou", {
      organization_id: entrada.organizationId,
      detail: err instanceof Error ? err.message.slice(0, 160) : "desconhecido",
    });
  }
}

/**
 * O lead escreveu de novo, e a mensagem anterior era nossa.
 * Alerta separado do cliente novo. Só sai se o dono ligou o alerta de resposta.
 */
export async function avisarAssessorSeLeadRespondeu(
  admin: Admin,
  entrada: {
    organizationId: string;
    contactId: string;
    conversationId: string;
    messageId: string | null;
    texto: string | null;
    nomeDoContato: string | null;
  },
): Promise<void> {
  try {
    if (!entrada.messageId) return;
    const { count, error: countErr } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", entrada.organizationId)
      .eq("conversation_id", entrada.conversationId)
      .eq("direction", "inbound");
    if (countErr || count == null || count < 2) return;

    const { data: recentes } = await admin
      .from("messages")
      .select("direction")
      .eq("organization_id", entrada.organizationId)
      .eq("conversation_id", entrada.conversationId)
      .order("created_at", { ascending: false })
      .limit(2);
    const anterior = recentes?.[1]?.direction;
    if (anterior !== "outbound") return;

    const { data: org } = await admin
      .from("organizations")
      .select("display_name, settings")
      .eq("id", entrada.organizationId)
      .maybeSingle();
    const cfg = lerAssessorNasSettings(org?.settings);
    const phones = destinatariosDaResposta(cfg.contacts);
    if (!phones.length) return;
    if (!deveAvisarResposta({
      replyEnabled: true,
      phone: phones[0],
      inboundCount: count,
      anteriorEraNosso: true,
    })) {
      return;
    }

    const { data: contato } = await admin
      .from("contacts")
      .select("display_name, name, phone_number")
      .eq("id", entrada.contactId)
      .eq("organization_id", entrada.organizationId)
      .maybeSingle();
    const nomeCliente =
      contato?.display_name || contato?.name || entrada.nomeDoContato || "Lead";
    const foneCliente = contato?.phone_number || "";
    const sent = await chamarAssessor({
      action: "alert",
      notice: "reply",
      phones,
      client_name: nomeCliente,
      client_phone: foneCliente || null,
      preview: (entrada.texto || "").slice(0, 180),
      organization: org?.display_name || "CRM",
      conversation_id: entrada.conversationId,
      event_id: entrada.messageId,
    }, 20000);
    const falhou = new Set<string>();
    for (const r of sent.results || []) {
      if (!r.ok) falhou.add(r.phone);
    }
    if (!sent.ok && falhou.size === 0) {
      for (const p of phones) falhou.add(p);
    }
    if (falhou.size) {
      const texto = [
        "💬 *Lead respondeu no CRM*",
        `👤 *${nomeCliente}*${foneCliente ? ` · ${foneCliente}` : ""}`,
        (entrada.texto || "").trim()
          ? `💬 ${(entrada.texto || "").trim().slice(0, 180)}`
          : "💬 Mandou outra mensagem.",
        "Entre no CRM e responda por lá.",
      ].join("\n");
      await avisarPeloWhatsappDoCrm(admin, [...falhou], texto);
      logger.warn("assessor: aviso de resposta não saiu pelo Assessor", {
        organization_id: entrada.organizationId,
        error: sent.error,
        phones: falhou.size,
      });
    }
  } catch (err) {
    logger.warn("assessor: aviso de resposta falhou", {
      organization_id: entrada.organizationId,
      detail: err instanceof Error ? err.message.slice(0, 160) : "desconhecido",
    });
  }
}

export function textoDoAvisoWhatsappCaiu(entrada: {
  apelido: string;
  status: string;
  organization: string;
}): string {
  return [
    "⚠️ *WhatsApp do CRM caiu*",
    `Empresa: *${entrada.organization}*`,
    `Conexão: *${entrada.apelido}* (${entrada.status})`,
    "Nenhuma mensagem entra nem sai por esta linha até ela voltar.",
    "Abra o CRM em Conexões e reconecte — se pedir QR, escaneie de novo.",
    "_Não precisa responder neste WhatsApp._",
  ].join("\n");
}

/**
 * A conexão caiu de verdade — avisa quem está na lista do Meu Assessor.
 * Uma vez por episódio: quem chama já deduplicou. Oscilação de rede não entra.
 */
export async function avisarAssessorWhatsappCaiu(
  admin: Admin,
  entrada: {
    organizationId: string;
    apelido: string;
    status: string;
    episodio: string;
  },
): Promise<void> {
  if (!deveAvisarQueda(entrada.episodio)) return;
  try {
    const { data: org } = await admin
      .from("organizations")
      .select("display_name, settings")
      .eq("id", entrada.organizationId)
      .maybeSingle();
    const cfg = lerAssessorNasSettings(org?.settings);
    const emails = await emailsDaOrganizacao(admin, entrada.organizationId);
    const fluxoComercial = ehFluxoComercialMoope(emails);
    const phones = destinatariosDoAviso({
      fluxoComercial,
      phones: destinatariosDaQueda(cfg.contacts),
    });
    if (!phones.length) return;

    const organization = org?.display_name || "CRM";
    const status = entrada.status || entrada.episodio;
    const texto = textoDoAvisoWhatsappCaiu({
      apelido: entrada.apelido,
      status,
      organization,
    });
    const sent = await chamarAssessor({
      action: "alert",
      notice: "whatsapp_down",
      phones,
      organization,
      preview: texto.slice(0, 180),
      event_id: `${entrada.organizationId}:${entrada.episodio}:${entrada.apelido}`,
    }, 20000);
    const falhou = new Set<string>();
    for (const r of sent.results || []) {
      if (!r.ok) falhou.add(r.phone);
    }
    if (!sent.ok && falhou.size === 0) {
      for (const p of phones) falhou.add(p);
    }
    if (falhou.size) {
      await avisarPeloWhatsappDoCrm(admin, [...falhou], texto);
    }
    if (!sent.ok) {
      logger.warn("assessor: aviso de WhatsApp caído não saiu", {
        organization_id: entrada.organizationId,
        error: sent.error,
        phones: phones.length,
      });
    }
  } catch (err) {
    logger.warn("assessor: aviso de WhatsApp caído falhou", {
      organization_id: entrada.organizationId,
      detail: err instanceof Error ? err.message.slice(0, 160) : "desconhecido",
    });
  }
}
