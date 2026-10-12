import { logger } from "@/lib/logger";
import type { createAdminClient } from "@/lib/supabase/admin";

import { chamarAssessor } from "./cliente";
import { avisarPeloWhatsappDoCrm } from "./aviso-waha";
import {
  destinatariosDoAviso,
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
    if (countErr || count !== 1) return;

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
      phoneConfigurado: cfg.phone,
      enabled: cfg.enabled,
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
    });
    const semJanela = new Set<string>();
    for (const r of sent.results || []) {
      if (!r.ok && r.error === "no_conversation") semJanela.add(r.phone);
    }
    if (!sent.ok && sent.error === "no_conversation") {
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
    if (!sent.ok && sent.error !== "secret_missing" && sent.error !== "no_conversation") {
      logger.warn("assessor: aviso de cliente novo não saiu", {
        organization_id: entrada.organizationId,
        conversation_id: entrada.conversationId,
        error: sent.error,
      });
    }
  } catch (err) {
    logger.warn("assessor: aviso de cliente novo falhou", {
      organization_id: entrada.organizationId,
      detail: err instanceof Error ? err.message.slice(0, 160) : "desconhecido",
    });
  }
}
