/**
 * Conversa programática p/ automação: acha a conversa aberta do contato na
 * sessão, REABRE a fechada, ou cria uma nova. Distinto da ingestão WAHA (que
 * usa RPCs de identidade) — aqui contato e sessão já são conhecidos.
 *
 * Por que reabrir: o índice uniq_conversations_1to1_per_contact_session é
 * único por (org, contato, sessão) SEM filtro de status — um contato cuja
 * única conversa está closed/archived tornaria o INSERT impossível (23505) e
 * o envio automatizado falharia pra sempre. Reabrir é também o comportamento
 * certo de produto: a conversa É o thread com aquele contato naquele número.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  sessoesSupersedidasDoNumero,
  type SessaoParaEnvio,
} from "@/lib/channels/sessao-viva-para-envio";

const OPEN_STATUSES = ["open", "pending", "claimed", "ai_handling"];

export async function ensureConversation(
  admin: SupabaseClient,
  organizationId: string,
  contactId: string,
  channelSessionId: string,
): Promise<string> {
  const { data: existing } = await admin
    .from("conversations")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .eq("channel_session_id", channelSessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; status: string };
    if (OPEN_STATUSES.includes(row.status)) return row.id;
    const { error: reopenErr } = await admin
      .from("conversations")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("organization_id", organizationId);
    if (reopenErr) throw new Error(reopenErr.message);
    return row.id;
  }

  const herdada = await reatacharConversaDaSessaoAntiga(
    admin,
    organizationId,
    contactId,
    channelSessionId,
  );
  if (herdada) return herdada;

  const { data: created, error } = await admin
    .from("conversations")
    .insert({
      organization_id: organizationId,
      contact_id: contactId,
      channel_session_id: channelSessionId,
      channel: "whatsapp",
      status: "open",
      metadata: { created_by: "automation" },
    })
    .select("id")
    .single();
  if (error || !created) {
    // Corrida: outro processo criou a conversa 1:1 entre o select e o insert.
    if ((error as { code?: string } | null)?.code === "23505") {
      const { data: winner } = await admin
        .from("conversations")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .eq("channel_session_id", channelSessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (winner) return (winner as { id: string }).id;
    }
    throw new Error(error?.message ?? "conversation_insert_failed");
  }
  return (created as { id: string }).id;
}

async function reatacharConversaDaSessaoAntiga(
  admin: SupabaseClient,
  organizationId: string,
  contactId: string,
  channelSessionId: string,
): Promise<string | null> {
  const { data: sessoes } = await admin
    .from("channel_sessions")
    .select("id, status, phone_number, archived_at")
    .eq("organization_id", organizationId);
  const irmas = (sessoes ?? []) as SessaoParaEnvio[];
  const viva = irmas.find((s) => s.id === channelSessionId);
  const antigas = sessoesSupersedidasDoNumero(viva, irmas);
  if (antigas.length === 0) return null;

  const { data: antiga } = await admin
    .from("conversations")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .in("channel_session_id", antigas)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!antiga) return null;

  const row = antiga as { id: string; status: string };
  const patch: Record<string, unknown> = {
    channel_session_id: channelSessionId,
    updated_at: new Date().toISOString(),
  };
  if (!OPEN_STATUSES.includes(row.status)) patch.status = "open";
  const { error } = await admin
    .from("conversations")
    .update(patch)
    .eq("id", row.id)
    .eq("organization_id", organizationId);
  if (error) return null;
  return row.id;
}
