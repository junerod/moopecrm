/**
 * Webhook hospedado → contato, conversa, mensagem.
 *
 * Endereço é o telefone (E.164). Sem thread opaca: o envio livre usa `To`.
 * Busca o contato pelas variantes do nono dígito — gravar outro cadastro
 * pela grafia do webhook parte o fio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureConversation } from "@/lib/automation/start-conversation";

import { phoneLookupVariants } from "../phone-variants";
import { aplicarEfeitosPosEntrada } from "../pos-entrada";
import { parseTwilioInbound } from "./webhook";

export interface TwilioIngestResult {
  status: "ingested" | "duplicate" | "ignored";
  conversationId?: string;
  messageId?: string;
  reason?: string;
}

export async function ingestTwilioInbound(
  admin: SupabaseClient,
  input: { organizationId: string; channelSessionId: string; payload: string },
): Promise<TwilioIngestResult> {
  const msg = parseTwilioInbound(input.payload);
  if (!msg) return { status: "ignored", reason: "evento_sem_interesse" };

  if (msg.kind === "status") {
    const { data } = await admin
      .from("messages")
      .update({
        status: msg.status,
        ...(msg.errorReason ? { error_message: msg.errorReason, error_code: "hosted_error" } : {}),
      })
      .eq("organization_id", input.organizationId)
      .eq("external_id", msg.externalId)
      .select("id")
      .maybeSingle();
    return data
      ? { status: "ingested", messageId: (data as { id: string }).id }
      : { status: "ignored", reason: "status_sem_mensagem" };
  }

  if (!msg.fromDigits) return { status: "ignored", reason: "sem_telefone" };

  const e164 = `+${msg.fromDigits}`;
  const contactId = await acharOuCriarContato(
    admin,
    input.organizationId,
    e164,
    msg.profileName,
  );
  if (!contactId) return { status: "ignored", reason: "contato_nao_criado" };

  const conversationId = await ensureConversation(
    admin,
    input.organizationId,
    contactId,
    input.channelSessionId,
  );

  const agora = new Date().toISOString();
  const { data: mensagem, error: errMsg } = await admin
    .from("messages")
    .insert({
      organization_id: input.organizationId,
      conversation_id: conversationId,
      contact_id: contactId,
      channel_session_id: input.channelSessionId,
      direction: "inbound",
      sent_via: "external_device",
      type: msg.mediaUrl ? "image" : "text",
      body: msg.text,
      external_id: msg.externalId,
      status: "delivered",
      ...(msg.mediaUrl
        ? { media_url: msg.mediaUrl, media_mime: msg.mediaMime }
        : {}),
      metadata: msg.mediaUrl ? { media_url: msg.mediaUrl, media_mime: msg.mediaMime } : {},
    } as never)
    .select("id")
    .single();

  if (errMsg) {
    if (errMsg.code === "23505") return { status: "duplicate", conversationId };
    return { status: "ignored", reason: errMsg.message };
  }

  await admin
    .from("conversations")
    .update({
      last_message_at: agora,
      last_inbound_at: agora,
      status: "open",
    })
    .eq("id", conversationId)
    .eq("organization_id", input.organizationId);

  await aplicarEfeitosPosEntrada(admin, {
    organizationId: input.organizationId,
    contactId,
    conversationId,
    messageId: (mensagem as { id: string }).id,
    channelSessionId: input.channelSessionId,
    texto: msg.text,
    nomeDoContato: msg.profileName,
    origem: "hosted_webhook",
  });

  return {
    status: "ingested",
    conversationId,
    messageId: (mensagem as { id: string }).id,
  };
}

async function acharOuCriarContato(
  admin: SupabaseClient,
  organizationId: string,
  e164: string,
  profileName: string | null,
): Promise<string | null> {
  const variantes = phoneLookupVariants(e164);
  const { data: existente } = await admin
    .from("contacts")
    .select("id, phone_number")
    .eq("organization_id", organizationId)
    .in("phone_number", variantes.length > 0 ? variantes : [e164])
    .is("is_merged_into", null)
    .limit(1)
    .maybeSingle();

  const phone = (existente as { phone_number: string } | null)?.phone_number ?? e164;
  if (existente) return (existente as { id: string }).id;

  const { data: contactId, error } = await admin.rpc("fn_upsert_wa_contact" as never, {
    p_org: organizationId,
    p_kind: "phone",
    p_phone: phone,
    p_lid: null,
    p_chat_id: e164,
    p_notify: profileName?.trim() || e164,
  } as never);
  if (error || !contactId) return null;
  return contactId as string;
}
