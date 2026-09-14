/**
 * Inbox: campanha REAL reusa a conversa do contato. Não cria thread paralelo.
 * Mock nunca chama isto. QR só envia se o fio já existir neste número.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureConversation } from "@/lib/automation/start-conversation";
import { decidirFioDaCampanha } from "@/lib/campanhas/fio-existente";
import type { SessaoParaEnvio } from "@/lib/channels/sessao-viva-para-envio";

export async function resolverConversaDaCampanha(
  db: SupabaseClient,
  entrada: {
    organizationId: string;
    contactId: string;
    channelSessionId?: string | null;
  },
): Promise<string | null> {
  const { data: existente } = await db
    .from("conversations")
    .select("id")
    .eq("organization_id", entrada.organizationId)
    .eq("contact_id", entrada.contactId)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existente) return (existente as { id: string }).id;
  if (!entrada.channelSessionId) return null;
  return ensureConversation(
    db,
    entrada.organizationId,
    entrada.contactId,
    entrada.channelSessionId,
  );
}

export async function acharFioExistenteParaCampanha(
  db: SupabaseClient,
  entrada: {
    organizationId: string;
    contactId: string;
    channelSessionId?: string | null;
  },
): Promise<{ conversationId: string; sessionId: string } | null> {
  const { data: sessoes } = await db
    .from("channel_sessions")
    .select("id, status, phone_number, archived_at")
    .eq("organization_id", entrada.organizationId);
  const { data: conversas } = await db
    .from("conversations")
    .select("id, channel_session_id")
    .eq("organization_id", entrada.organizationId)
    .eq("contact_id", entrada.contactId)
    .order("last_message_at", { ascending: false });
  const dec = decidirFioDaCampanha({
    sessaoPedida: entrada.channelSessionId ?? null,
    sessoes: (sessoes ?? []) as SessaoParaEnvio[],
    conversas: (conversas ?? []) as Array<{ id: string; channel_session_id: string }>,
  });
  if (!dec) return null;
  const atual = (conversas ?? []).find((c) => (c as { id: string }).id === dec.conversationId) as
    | { channel_session_id: string }
    | undefined;
  if (atual && atual.channel_session_id !== dec.sessionId) {
    await db
      .from("conversations")
      .update({
        channel_session_id: dec.sessionId,
        status: "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", dec.conversationId)
      .eq("organization_id", entrada.organizationId);
  }
  return dec;
}

export async function registrarOutboundDaCampanha(
  db: SupabaseClient,
  entrada: {
    organizationId: string;
    contactId: string;
    campaignId: string;
    body: string;
    destination: string;
    externalId?: string | null;
    mediaPath?: string | null;
    channelSessionId?: string | null;
    conversationId?: string | null;
  },
): Promise<string | null> {
  const conversationId =
    entrada.conversationId ??
    (await resolverConversaDaCampanha(db, {
      organizationId: entrada.organizationId,
      contactId: entrada.contactId,
      channelSessionId: entrada.channelSessionId,
    }));
  if (!conversationId) return null;

  const agora = new Date().toISOString();
  const { data, error } = await db
    .from("messages")
    .insert({
      organization_id: entrada.organizationId,
      conversation_id: conversationId,
      contact_id: entrada.contactId,
      channel_session_id: entrada.channelSessionId ?? null,
      type: "text",
      direction: "outbound",
      status: "sent",
      body: entrada.body,
      external_id: entrada.externalId ?? null,
      sent_via: "system",
      sent_at: agora,
      metadata: {
        campaign_id: entrada.campaignId,
        provenance: "campaign_commercial",
        destination: entrada.destination,
      },
    } as never)
    .select("id")
    .maybeSingle();
  if (error || !data) return null;

  await db
    .from("conversations")
    .update({
      last_message_preview: entrada.body.slice(0, 140),
      last_message_at: agora,
      updated_at: agora,
    })
    .eq("id", conversationId)
    .eq("organization_id", entrada.organizationId);

  return (data as { id: string }).id;
}
