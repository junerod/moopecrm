/**
 * Worker de campanha — lote + pacing + opt-out recheck + idempotência.
 * Envio MOCK nesta rodada. Não loopa 5.000 na request.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { destinatarioPodeReceberCampanha } from "@/lib/campanhas/consentimento";
import { enviarCampanhaMock } from "@/lib/campanhas/mock-envio";
import { PACING_CAMPANHA_MS, podeEnviarAgora } from "@/lib/campanhas/pacing";
import { previewDaCampanha } from "@/lib/campanhas/preview";
import { destinatarioTerminal, podeTransitarCampanha } from "@/lib/campanhas/transicoes";
import type { ContatoParaSegmento, StatusDaCampanha } from "@/lib/campanhas/tipos";

const LOTE_PADRAO = 20;

export interface ResultadoDoTick {
  processadas: number;
  enviados: number;
  pulados: number;
  falharam: number;
  canceladas: number;
  entregas: ReturnType<typeof enviarCampanhaMock>[];
}

interface CampanhaRow {
  id: string;
  organization_id: string;
  status: StatusDaCampanha;
  body_text: string;
  template_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  last_sent_at: string | null;
  channel_session_id: string | null;
}

interface DestRow {
  id: string;
  contact_id: string;
  status: string;
  phone: string | null;
}

export async function materializarDestinatarios(
  db: SupabaseClient,
  entrada: {
    organizationId: string;
    campaignId: string;
    contactIds: string[];
    contatos: ContatoParaSegmento[];
  },
): Promise<{ inseridos: number; pulados: number }> {
  let inseridos = 0;
  let pulados = 0;
  const porId = new Map(entrada.contatos.map((c) => [c.id, c]));
  for (const contactId of entrada.contactIds) {
    const contato = porId.get(contactId);
    const guarda = destinatarioPodeReceberCampanha(contato);
    const row = {
      organization_id: entrada.organizationId,
      campaign_id: entrada.campaignId,
      contact_id: contactId,
      phone: guarda.ok ? guarda.phone : contato?.phone_number ?? null,
      status: guarda.ok ? "pending" : "skipped",
      error: guarda.ok ? null : guarda.reason,
    };
    const { error } = await db.from("campaign_recipients").insert(row);
    if (error) {
      if (error.code === "23505") continue;
      throw error;
    }
    if (guarda.ok) inseridos += 1;
    else pulados += 1;
  }
  return { inseridos, pulados };
}

export async function cancelarCampanha(
  db: SupabaseClient,
  entrada: { organizationId: string; campaignId: string; agora?: Date },
): Promise<{ ok: true } | { ok: false; motivo: string }> {
  const { data: camp } = await db
    .from("campaigns")
    .select("id, status")
    .eq("id", entrada.campaignId)
    .eq("organization_id", entrada.organizationId)
    .maybeSingle();
  const atual = (camp as { status?: StatusDaCampanha } | null)?.status;
  if (!atual) return { ok: false, motivo: "nao_encontrada" };
  if (!podeTransitarCampanha(atual, "cancelled")) {
    return { ok: false, motivo: "estado_terminal" };
  }
  const agora = (entrada.agora ?? new Date()).toISOString();
  await db
    .from("campaigns")
    .update({ status: "cancelled", finished_at: agora, updated_at: agora })
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
  const lote = opts.lote ?? LOTE_PADRAO;
  const pacingMs = opts.pacingMs ?? PACING_CAMPANHA_MS;
  const resultado: ResultadoDoTick = {
    processadas: 0,
    enviados: 0,
    pulados: 0,
    falharam: 0,
    canceladas: 0,
    entregas: [],
  };

  await promoverAgendadas(db, agora);

  const { data: vivas } = await db
    .from("campaigns")
    .select(
      "id, organization_id, status, body_text, template_id, scheduled_at, started_at, last_sent_at, channel_session_id",
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
      "id, organization_id, status, body_text, template_id, scheduled_at, started_at, last_sent_at, channel_session_id",
    )
    .eq("status", "running")
    .order("created_at", { ascending: true })
    .limit(10);

  for (const camp of (campanhas ?? []) as CampanhaRow[]) {
    resultado.processadas += 1;
    const { data: sessao } = camp.channel_session_id
      ? await db
          .from("channel_sessions")
          .select("provider")
          .eq("id", camp.channel_session_id)
          .eq("organization_id", camp.organization_id)
          .maybeSingle()
      : { data: null };
    const provider = (sessao as { provider?: string } | null)?.provider ?? null;

    const { data: dests } = await db
      .from("campaign_recipients")
      .select("id, contact_id, status, phone")
      .eq("campaign_id", camp.id)
      .eq("organization_id", camp.organization_id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(lote);

    let lastSent = camp.last_sent_at;
    for (const dest of (dests ?? []) as DestRow[]) {
      if (destinatarioTerminal(dest.status as never)) continue;
      if (!podeEnviarAgora({ lastSentAt: lastSent, agora, pacingMs })) break;

      const { data: contato } = await db
        .from("contacts")
        .select("id, display_name, name, phone_number, email, is_blocked, consent")
        .eq("id", dest.contact_id)
        .eq("organization_id", camp.organization_id)
        .maybeSingle();

      const guarda = destinatarioPodeReceberCampanha(contato as ContatoParaSegmento | null);
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
          nome: (contato as { display_name?: string; name?: string } | null)?.display_name
            || (contato as { name?: string } | null)?.name
            || "",
          telefone: guarda.phone,
          email: (contato as { email?: string } | null)?.email ?? "",
        },
      });

      const entrega = enviarCampanhaMock({
        campaignId: camp.id,
        contactId: dest.contact_id,
        destE164: guarda.phone,
        body: preview.texto,
        templateId: camp.template_id,
        provider,
      });
      resultado.entregas.push(entrega);

      const iso = agora.toISOString();
      const { data: updated } = await db
        .from("campaign_recipients")
        .update({
          status: "sent",
          sent_at: iso,
          delivered_at: iso,
          phone: guarda.phone,
          error: null,
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

async function atribuirRespostasAbertas(db: SupabaseClient, agora: Date): Promise<void> {
  const { data: abertas } = await db
    .from("campaigns")
    .select(
      "id, organization_id, status, body_text, template_id, scheduled_at, started_at, last_sent_at, channel_session_id",
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
  const { data: enviados } = await db
    .from("campaign_recipients")
    .select("id, contact_id, lead_id")
    .eq("campaign_id", camp.id)
    .eq("organization_id", camp.organization_id)
    .in("status", ["sent", "delivered", "read"])
    .is("replied_at", null)
    .limit(100);
  for (const dest of (enviados ?? []) as Array<{
    id: string;
    contact_id: string;
    lead_id: string | null;
  }>) {
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
