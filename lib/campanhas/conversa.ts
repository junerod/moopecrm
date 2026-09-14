/**
 * Inbox: campanha REAL reusa a conversa do contato. Não cria thread paralelo.
 * Mock nunca chama isto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureConversation } from "@/lib/automation/start-conversation";

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
  },
): Promise<string | null> {
  const conversationId = await resolverConversaDaCampanha(db, {
    organizationId: entrada.organizationId,
    contactId: entrada.contactId,
    channelSessionId: entrada.channelSessionId,
  });
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
