/**
 * DM recebida → contato, conversa, mensagem na mesma Inbox.
 *
 * Identidade é `igsid:` em `wa_identity`, não telefone. Sem número a pessoa
 * do WhatsApp e a do Direct nascem dois cadastros — fundir sem sinal é
 * irreversível dentro do webhook. Se o referral trouxer anúncio, estampa
 * origem no primeiro toque (a mesma função do WhatsApp oficial).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { estamparAtribuicaoDoContato } from "@/lib/leads/atribuicao-de-anuncio";

import { ARCHIVED_AT, queryTolerantToMissingArchived } from "../archived";
import { CHANNEL_PROVIDER_INSTAGRAM } from "../capabilities";
import { aplicarEfeitosPosEntrada } from "../pos-entrada";
import type { ChannelTenantScope } from "../types";
import { extrairAtribuicaoDirect } from "./atribuicao";
import type { DirectInboundEvent } from "./webhook";

type Admin = SupabaseClient;

export type DirectIngestOutcome =
  | { status: "ingested"; messageId: string; conversationId: string }
  | { status: "duplicate" }
  | { status: "no_session" }
  | { status: "failed"; reason: string };

async function sessaoDaConta(admin: Admin, organizationId: string, accountId: string) {
  const base = () =>
    admin
      .from("channel_sessions")
      .select("id, organization_id")
      .eq("organization_id", organizationId)
      .eq("provider", CHANNEL_PROVIDER_INSTAGRAM)
      .eq("instagram_account_id", accountId);
  const { data, error } = await queryTolerantToMissingArchived(
    () => base().is(ARCHIVED_AT, null).maybeSingle(),
    () => base().maybeSingle(),
  );
  if (error) {
    throw new Error(
      `sessao_do_direct: ${error.code ?? "sem_codigo"} ${error.message ?? ""}`.trim(),
    );
  }
  return data;
}

async function acharOuCriarContato(
  admin: Admin,
  orgId: string,
  igsid: string,
  username: string | null,
): Promise<string> {
  const identidade = `igsid:${igsid}`;
  const { data: existente } = await admin
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("wa_identity", identidade)
    .is("is_merged_into", null)
    .maybeSingle();
  if (existente) return existente.id;

  const nome = username?.trim() || `Direct ${igsid.slice(-6)}`;
  const { data: criado, error } = await admin
    .from("contacts")
    .insert({
      organization_id: orgId,
      phone_number: null,
      display_name: nome,
      name: nome,
      wa_identity: identidade,
      source: "instagram",
      source_metadata: { igsid, ...(username ? { username } : {}) },
    })
    .select("id")
    .maybeSingle();

  if (error?.code === "23505") {
    const { data: deNovo } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("wa_identity", identidade)
      .is("is_merged_into", null)
      .maybeSingle();
    if (deNovo) return deNovo.id;
  }
  if (error || !criado) {
    throw new Error(`contato: ${error?.message ?? "sem id"}`);
  }
  return criado.id;
}

export async function ingestDirectInbound(
  admin: Admin,
  e: DirectInboundEvent,
  dono: ChannelTenantScope,
): Promise<DirectIngestOutcome> {
  let sessao: { id: string; organization_id: string } | null;
  try {
    sessao = await sessaoDaConta(admin, dono.organizationId, e.accountId);
  } catch (err) {
    return { status: "failed", reason: err instanceof Error ? err.message : "sessao_do_direct" };
  }
  if (!sessao) return { status: "no_session" };

  const orgId = sessao.organization_id;
  let contactId: string;
  try {
    contactId = await acharOuCriarContato(admin, orgId, e.from, e.username);
  } catch (err) {
    return { status: "failed", reason: err instanceof Error ? err.message : "contato" };
  }

  const { data: conversationId, error: erroConversa } = await admin.rpc(
    "fn_upsert_wa_conversation" as never,
    { p_org: orgId, p_contact: contactId, p_session: sessao.id } as never,
  );
  if (erroConversa || !conversationId) {
    return { status: "failed", reason: `conversa: ${erroConversa?.message ?? "sem id"}` };
  }

  await admin
    .from("conversations")
    .update({ provider_conversation_id: e.from })
    .eq("id", conversationId as string)
    .eq("organization_id", orgId)
    .is("provider_conversation_id", null);

  const { data: inserida, error: erroInsert } = await admin
    .from("messages")
    .insert({
      organization_id: orgId,
      conversation_id: conversationId as string,
      channel_session_id: sessao.id,
      contact_id: contactId,
      direction: "inbound",
      status: "delivered",
      type: "text",
      body: e.text,
      external_id: e.externalId,
      sent_at: e.sentAt.toISOString(),
      metadata: { igsid: e.from },
    })
    .select("id")
    .maybeSingle();

  if (erroInsert) {
    if (erroInsert.code === "23505") return { status: "duplicate" };
    return { status: "failed", reason: `mensagem: ${erroInsert.message}` };
  }

  await admin.rpc("fn_mark_conversation_message" as never, {
    p_conv: conversationId as string,
    p_direction: "inbound",
    p_preview: (e.text ?? "Direct").slice(0, 120),
    p_at: e.sentAt.toISOString(),
  } as never);

  const atribuicao = extrairAtribuicaoDirect(e.referral);
  if (atribuicao) {
    await estamparAtribuicaoDoContato(admin, contactId, atribuicao);
  }

  const messageId = (inserida as { id: string } | null)?.id ?? "";
  await aplicarEfeitosPosEntrada(admin, {
    organizationId: orgId,
    contactId,
    conversationId: conversationId as string,
    messageId,
    channelSessionId: sessao.id,
    texto: e.text,
    nomeDoContato: e.username,
    origem: "direct_webhook",
  });

  return { status: "ingested", messageId, conversationId: conversationId as string };
}
