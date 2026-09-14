/**
 * Worker de campanha — materialização em lote + pacing + opt-out + dispatcher.
 * Mock só quando o diagnóstico pede mock. Não grava conversation no mock.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { carregarContatosDoSegmento } from "@/lib/campanhas/carregar-contatos";
import { destinatarioPodeReceberNoCanal } from "@/lib/campanhas/consentimento";
import { lerModoDoDispatch } from "@/lib/campanhas/diagnostico";
import { dispatchRecipient } from "@/lib/campanhas/dispatcher";
import { materializarProximoLote, selecaoDosSettings } from "@/lib/campanhas/materializar";
import { PACING_CAMPANHA_MS, podeEnviarAgora } from "@/lib/campanhas/pacing";
import { previewDaCampanha } from "@/lib/campanhas/preview";
import {
  escolherSessaoParaCampanha,
  type SessaoDaCampanha,
} from "@/lib/campanhas/sessao-da-campanha";
import { lerSettings } from "@/lib/campanhas/settings";
import { destinatarioTerminal, podeTransitarCampanha } from "@/lib/campanhas/transicoes";
import type {
  CanalDaCampanha,
  ContatoParaSegmento,
  SegmentoDaCampanha,
  StatusDaCampanha,
} from "@/lib/campanhas/tipos";
import { LOTE_ENVIO } from "@/lib/campanhas/tipos";
import { getAdapter } from "@/lib/channels";
import { CHANNEL_SESSION_REF_COLUMNS, resolveSessionRef, type ChannelSessionRef } from "@/lib/channels/session-ref";
import type { ChannelProvider } from "@/lib/channels/types";

export interface ResultadoDoTick {
  processadas: number;
  enviados: number;
  pulados: number;
  falharam: number;
  canceladas: number;
  materializados: number;
  entregas: Array<{
    via: string;
    classificacao: string;
    dest_e164?: string;
    campaign_id?: string;
  }>;
}

interface CampanhaRow {
  id: string;
  organization_id: string;
  name: string;
  status: StatusDaCampanha;
  body_text: string;
  template_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  last_sent_at: string | null;
  channel_session_id: string | null;
  segment: SegmentoDaCampanha;
  settings: unknown;
}

interface DestRow {
  id: string;
  contact_id: string;
  status: string;
  phone: string | null;
  channel?: string | null;
  destination?: string | null;
}

export { materializarDestinatarios } from "@/lib/campanhas/materializar";

export async function cancelarCampanha(
  db: SupabaseClient,
  entrada: { organizationId: string; campaignId: string; agora?: Date },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data: camp } = await db
    .from("campaigns")
    .select("id, status, settings")
    .eq("id", entrada.campaignId)
    .eq("organization_id", entrada.organizationId)
    .maybeSingle();
  const atual = (camp as { status?: StatusDaCampanha; settings?: unknown } | null)?.status;
  if (!atual) return { ok: false, motivo: "nao_encontrada" };
  const settings = lerSettings((camp as { settings?: unknown } | null)?.settings);
  const preparando = atual === "draft" && settings.preparing;
  if (!podeTransitarCampanha(atual, "cancelled") && !preparando) {
    return { ok: false, motivo: "estado_terminal" };
  }
  const agora = (entrada.agora ?? new Date()).toISOString();
  await db
    .from("campaigns")
    .update({
      status: "cancelled",
      finished_at: agora,
      updated_at: agora,
      settings: { ...settings, preparing: false, materializing: false },
    })
    .eq("id", entrada.campaignId)
    .eq("organization_id", entrada.organizationId);
  await db
    .from("campaign_recipients")
    .update({ status: "cancelled" })
    .eq("campaign_id", entrada.campaignId)
    .eq("organization_id", entrada.organizationId)
    .eq("status", "pending");
  return { ok: true };
}

export async function processarTickDasCampanhas(
  db: SupabaseClient,
  opts: { agora?: Date; lote?: number; pacingMs?: number } = {},
): Promise<ResultadoDoTick> {
  const agora = opts.agora ?? new Date();
  const lote = opts.lote ?? LOTE_ENVIO;
  const pacingMs = opts.pacingMs ?? PACING_CAMPANHA_MS;
  const resultado: ResultadoDoTick = {
    processadas: 0,
    enviados: 0,
    pulados: 0,
    falharam: 0,
    canceladas: 0,
    materializados: 0,
    entregas: [],
  };

  await promoverAgendadas(db, agora);
  resultado.materializados += await materializarPreparando(db);

  const { data: vivas } = await db
    .from("campaigns")
    .select(
      "id, organization_id, name, status, body_text, template_id, scheduled_at, started_at, last_sent_at, channel_session_id, segment, settings",
    )
    .eq("status", "running")
    .order("created_at", { ascending: true })
    .limit(40);
  for (const camp of (vivas ?? []) as CampanhaRow[]) {
    await encerrarSeAcabou(db, camp, agora);
  }

  const { data: campanhas } = await db
    .from("campaigns")
    .select(
      "id, organization_id, name, status, body_text, template_id, scheduled_at, started_at, last_sent_at, channel_session_id, segment, settings",
    )
    .eq("status", "running")
    .order("created_at", { ascending: true })
    .limit(10);

  const modo = lerModoDoDispatch();

  for (const camp of (campanhas ?? []) as CampanhaRow[]) {
    resultado.processadas += 1;
    const settings = lerSettings(camp.settings);
    const sessao = await resolverSessaoDaCampanha(db, camp);
    const provider = (sessao?.provider ?? null) as ChannelProvider | null;
    let sessionRef: string | null = null;
    if (sessao) {
      try {
        const ref = resolveSessionRef(sessao as unknown as ChannelSessionRef);
        sessionRef = ref?.trim() ? ref : null;
      } catch {
        sessionRef = null;
      }
    }
    const adapterConfigured = provider ? getAdapter(provider).isConfigured() : false;

    const { data: dests } = await db
      .from("campaign_recipients")
      .select("id, contact_id, status, phone, channel, destination")
      .eq("campaign_id", camp.id)
      .eq("organization_id", camp.organization_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(lote);

    let lastSent = camp.last_sent_at;
    const orgInfo = await carregarRodape(db, camp.organization_id);

    for (const dest of (dests ?? []) as DestRow[]) {
      if (destinatarioTerminal(dest.status as never)) continue;
      if (!podeEnviarAgora({ lastSentAt: lastSent, agora, pacingMs })) break;

      const { data: campAtual } = await db
        .from("campaigns")
        .select("status")
        .eq("id", camp.id)
        .eq("organization_id", camp.organization_id)
        .maybeSingle();
      if ((campAtual as { status?: string } | null)?.status === "cancelled") {
        resultado.canceladas += 1;
        break;
      }

      const { data: contato } = await db
        .from("contacts")
        .select("id, display_name, name, phone_number, email, is_blocked, consent, wa_lid, wa_identity")
        .eq("id", dest.contact_id)
        .eq("organization_id", camp.organization_id)
        .maybeSingle();

      const canal = (dest.channel === "email" ? "email" : "whatsapp") as CanalDaCampanha;
      const guarda = destinatarioPodeReceberNoCanal(contato as ContatoParaSegmento | null, canal);
      if (!guarda.ok) {
        await db
          .from("campaign_recipients")
          .update({ status: "skipped", error: guarda.reason })
          .eq("id", dest.id)
          .eq("organization_id", camp.organization_id)
          .eq("status", "pending");
        resultado.pulados += 1;
        continue;
      }

      const preview = previewDaCampanha({
        template: camp.body_text,
        valores: {
          nome:
            (contato as { display_name?: string; name?: string } | null)?.display_name ||
            (contato as { name?: string } | null)?.name ||
            "",
          telefone: (contato as { phone_number?: string } | null)?.phone_number ?? "",
          email: (contato as { email?: string } | null)?.email ?? "",
        },
      });

      const anexo = (settings.attachments ?? [])[0];
      const entrega = await dispatchRecipient(db, {
        organizationId: camp.organization_id,
        campaignId: camp.id,
        campaignName: camp.name,
        contactId: dest.contact_id,
        canal,
        destination: guarda.destination,
        body: preview.texto,
        provider,
        sessionRef,
        channelSessionId: sessao?.id ?? camp.channel_session_id,
        adapterConfigured,
        waLid: (contato as { wa_lid?: string | null } | null)?.wa_lid ?? null,
        waIdentity: (contato as { wa_identity?: string | null } | null)?.wa_identity ?? null,
        templateId: camp.template_id,
        mediaKind: anexo?.kind ?? null,
        mediaFilename: anexo?.filename ?? null,
        ctaUrl: settings.cta_url,
        ctaLabel: settings.cta_label,
        rodape: orgInfo,
        modo,
      });
      resultado.entregas.push({
        via: entrega.via,
        classificacao: entrega.classificacao,
        dest_e164: guarda.destination,
        campaign_id: camp.id,
      });

      const iso = agora.toISOString();
      if (entrega.status === "skipped") {
        await db
          .from("campaign_recipients")
          .update({
            status: "skipped",
            error: entrega.reason ?? "skipped",
            destination: guarda.destination,
          })
          .eq("id", dest.id)
          .eq("organization_id", camp.organization_id)
          .eq("status", "pending");
        resultado.pulados += 1;
        continue;
      }
      if (entrega.status === "failed") {
        await db
          .from("campaign_recipients")
          .update({
            status: "failed",
            failed_at: iso,
            error: entrega.reason ?? "send_failed",
            destination: guarda.destination,
          })
          .eq("id", dest.id)
          .eq("organization_id", camp.organization_id)
          .eq("status", "pending");
        resultado.falharam += 1;
        continue;
      }

      const { data: updated } = await db
        .from("campaign_recipients")
        .update({
          status: "sent",
          sent_at: iso,
          delivered_at: entrega.via === "real" ? null : null,
          phone: canal === "whatsapp" ? guarda.destination : dest.phone,
          destination: guarda.destination,
          error: entrega.via === "mock" ? "mock_nao_enviou" : null,
          message_id: entrega.messageId ?? null,
        })
        .eq("id", dest.id)
        .eq("organization_id", camp.organization_id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();

      if (!updated) {
        resultado.pulados += 1;
        continue;
      }
      resultado.enviados += 1;
      lastSent = iso;
      await db
        .from("campaigns")
        .update({ last_sent_at: iso, updated_at: iso })
        .eq("id", camp.id)
        .eq("organization_id", camp.organization_id);
    }

    await atribuirRespostasRecentes(db, camp, agora);
    await encerrarSeAcabou(db, camp, agora);
  }

  await atribuirRespostasAbertas(db, agora);

  return resultado;
}

async function materializarPreparando(db: SupabaseClient): Promise<number> {
  const { data: drafts } = await db
    .from("campaigns")
    .select(
      "id, organization_id, name, status, body_text, template_id, scheduled_at, started_at, last_sent_at, channel_session_id, segment, settings",
    )
    .eq("status", "draft")
    .limit(10);
  let total = 0;
  for (const camp of (drafts ?? []) as CampanhaRow[]) {
    const settings = lerSettings(camp.settings);
    if (!settings.preparing) continue;
    const { data: viva } = await db
      .from("campaigns")
      .select("status")
      .eq("id", camp.id)
      .eq("organization_id", camp.organization_id)
      .maybeSingle();
    if ((viva as { status?: string } | null)?.status === "cancelled") continue;

    const segmento = (camp.segment ?? {}) as SegmentoDaCampanha;
    const contatos = await carregarContatosDoSegmento(db, camp.organization_id, segmento);
    const r = await materializarProximoLote(db, {
      organizationId: camp.organization_id,
      campaignId: camp.id,
      contatos,
      segmento,
      selecao: selecaoDosSettings(camp.settings),
    });
    total += r.inseridos + r.pulados;
    if (!r.concluido) continue;

    const agora = new Date().toISOString();
    const scheduled = camp.scheduled_at;
    const vaiAgora = !scheduled || new Date(scheduled).getTime() <= Date.now();
    await db
      .from("campaigns")
      .update({
        status: vaiAgora ? "running" : "scheduled",
        started_at: vaiAgora ? agora : null,
        updated_at: agora,
        settings: { ...settings, preparing: false, materializing: false },
      })
      .eq("id", camp.id)
      .eq("organization_id", camp.organization_id)
      .eq("status", "draft");
  }
  return total;
}

async function carregarRodape(
  db: SupabaseClient,
  organizationId: string,
): Promise<{ nome: string; telefone?: string | null; email?: string | null; endereco?: string | null }> {
  const { data } = await db
    .from("organizations")
    .select("name, legal_name, settings")
    .eq("id", organizationId)
    .maybeSingle();
  const row = data as { name?: string; legal_name?: string; settings?: { branding?: { phone?: string; email?: string; address?: string } } } | null;
  const branding = row?.settings?.branding;
  return {
    nome: row?.legal_name || row?.name || "Empresa",
    telefone: branding?.phone ?? null,
    email: branding?.email ?? null,
    endereco: branding?.address ?? null,
  };
}

async function atribuirRespostasAbertas(db: SupabaseClient, agora: Date): Promise<void> {
  const { data: abertas } = await db
    .from("campaigns")
    .select(
      "id, organization_id, name, status, body_text, template_id, scheduled_at, started_at, last_sent_at, channel_session_id, segment, settings",
    )
    .in("status", ["completed", "running"])
    .order("finished_at", { ascending: false })
    .limit(20);
  for (const camp of (abertas ?? []) as CampanhaRow[]) {
    await atribuirRespostasRecentes(db, camp, agora);
  }
}

async function atribuirRespostasRecentes(
  db: SupabaseClient,
  camp: CampanhaRow,
  agora: Date,
): Promise<void> {
  void agora;
  const { data: enviados } = await db
    .from("campaign_recipients")
    .select("id, contact_id, lead_id, message_id")
    .eq("campaign_id", camp.id)
    .eq("organization_id", camp.organization_id)
    .in("status", ["sent", "delivered", "read"])
    .is("replied_at", null)
    .limit(100);
  for (const dest of (enviados ?? []) as Array<{
    id: string;
    contact_id: string;
    lead_id: string | null;
    message_id: string | null;
  }>) {
    // Mock não cria message — atribuir inbound antigo vira "respondeu" mentiroso.
    if (!dest.message_id) continue;
    const { data: conv } = await db
      .from("conversations")
      .select("id")
      .eq("organization_id", camp.organization_id)
      .eq("contact_id", dest.contact_id)
      .limit(1)
      .maybeSingle();
    if (!conv) continue;
    const { data: msg } = await db
      .from("messages")
      .select("id, created_at")
      .eq("organization_id", camp.organization_id)
      .eq("conversation_id", (conv as { id: string }).id)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!msg) continue;
    const quando = (msg as { created_at: string }).created_at;
    if (camp.last_sent_at && quando < camp.last_sent_at) continue;
    const { data: lead } = await db
      .from("crm_leads")
      .select("id")
      .eq("organization_id", camp.organization_id)
      .eq("contact_id", dest.contact_id)
      .eq("status", "open")
      .maybeSingle();
    await db
      .from("campaign_recipients")
      .update({
        status: "replied",
        replied_at: quando,
        lead_id: dest.lead_id ?? (lead as { id?: string } | null)?.id ?? null,
      })
      .eq("id", dest.id)
      .eq("organization_id", camp.organization_id);
  }
}

async function resolverSessaoDaCampanha(
  db: SupabaseClient,
  camp: CampanhaRow,
): Promise<SessaoDaCampanha | null> {
  const { data } = await db
    .from("channel_sessions")
    .select(`id, status, phone_number, archived_at, ${CHANNEL_SESSION_REF_COLUMNS}`)
    .eq("organization_id", camp.organization_id);
  const irmas = (data ?? []) as SessaoDaCampanha[];
  const pedida = camp.channel_session_id
    ? (irmas.find((s) => s.id === camp.channel_session_id) ?? null)
    : null;
  const escolhida = escolherSessaoParaCampanha(pedida, irmas);
  if (escolhida && escolhida.id !== camp.channel_session_id) {
    await db
      .from("campaigns")
      .update({ channel_session_id: escolhida.id, updated_at: new Date().toISOString() })
      .eq("id", camp.id)
      .eq("organization_id", camp.organization_id);
    camp.channel_session_id = escolhida.id;
  }
  return escolhida;
}

async function promoverAgendadas(db: SupabaseClient, agora: Date): Promise<void> {
  await db
    .from("campaigns")
    .update({ status: "running", started_at: agora.toISOString(), updated_at: agora.toISOString() })
    .eq("status", "scheduled")
    .lte("scheduled_at", agora.toISOString());
}

async function encerrarSeAcabou(
  db: SupabaseClient,
  camp: CampanhaRow,
  agora: Date,
): Promise<void> {
  const { count } = await db
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", camp.id)
    .eq("organization_id", camp.organization_id)
    .eq("status", "pending");
  if ((count ?? 0) > 0) return;
  await db
    .from("campaigns")
    .update({
      status: "completed",
      finished_at: agora.toISOString(),
      updated_at: agora.toISOString(),
    })
    .eq("id", camp.id)
    .eq("organization_id", camp.organization_id)
    .eq("status", "running");
}
