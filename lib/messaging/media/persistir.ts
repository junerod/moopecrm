/**
 * Baixa o anexo do canal e grava no bucket `whatsapp-media`.
 *
 * Três chamadores, um só caminho: o worker (`media.persist_requested`), a
 * ingestão (ainda no webhook, enquanto o arquivo existe) e o GET da inbox
 * (quem abre a conversa tenta de novo — anti-morte da mídia).
 */
import {
  CHANNEL_SESSION_REF_COLUMNS,
  DEFAULT_CHANNEL_PROVIDER,
  getAdapter,
  resolveSessionRef,
  type ChannelProvider,
  type ChannelSessionRef,
} from "@/lib/channels";
import { sessaoVivaParaMidia } from "@/lib/channels/sessoes-residuais";
import { logger } from "@/lib/logger";
import { storagePathFor, type FetchedMedia } from "@/lib/messaging/media/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const MEDIA_PERSIST_CONSUMER_KEY = "media_persist_v1";

// Espelha MAX_ATTEMPTS de lib/event-log/drain.ts (não exportado de lá).
const DRAIN_MAX_ATTEMPTS = 5;

const TIPOS_COM_ARQUIVO = new Set(["image", "video", "audio", "document", "sticker"]);

interface MessageMediaRow {
  channel_session_id: string;
  id: string;
  organization_id: string;
  conversation_id: string;
  type: string;
  external_id: string | null;
  media_url: string | null;
  media_mime: string | null;
  media_storage_path: string | null;
  metadata: Record<string, unknown> | null;
}

function temPonteiroDeMidia(msg: MessageMediaRow | null): msg is MessageMediaRow {
  if (!msg) return false;
  if (msg.media_url || msg.media_mime) return true;
  return TIPOS_COM_ARQUIVO.has(msg.type);
}

export interface ResultadoPersistirMidia {
  consumer_key: string;
  status: "ok" | "skipped" | "error";
  detail?: string;
  media?: FetchedMedia;
}

export async function persistirMidiaDaMensagem(input: {
  organizationId: string;
  messageId: string;
  attempts?: number;
}): Promise<ResultadoPersistirMidia> {
  const consumer_key = MEDIA_PERSIST_CONSUMER_KEY;
  const { organizationId, messageId } = input;
  const attempts = input.attempts ?? 0;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("messages")
    .select(
      "id, organization_id, conversation_id, channel_session_id, type, external_id, media_url, media_mime, media_storage_path, metadata",
    )
    .eq("id", messageId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) return { consumer_key, status: "error", detail: error.message };

  const msg = data as MessageMediaRow | null;
  if (!temPonteiroDeMidia(msg)) {
    return { consumer_key, status: "skipped", detail: "sem ponteiro de midia" };
  }
  if (msg.media_storage_path) return { consumer_key, status: "skipped", detail: "already stored" };

  const markStatus = async (media_status: "stored" | "failed", patch: Record<string, unknown> = {}) => {
    const { error: updErr } = await admin
      .from("messages")
      .update({ metadata: { ...(msg.metadata ?? {}), media_status }, ...patch })
      .eq("id", msg.id)
      .eq("organization_id", msg.organization_id);
    if (updErr) throw new Error(`message update failed: ${updErr.message}`);
  };

  const isLastAttempt = attempts >= DRAIN_MAX_ATTEMPTS - 1;

  let media: FetchedMedia;
  try {
    const { data: sessoes } = await admin
      .from("channel_sessions")
      .select(`id, status, phone_number, provider, ${CHANNEL_SESSION_REF_COLUMNS}`)
      .eq("organization_id", msg.organization_id);

    const desta = (sessoes ?? []).find((s) => s.id === msg.channel_session_id) ?? null;
    const sessao = desta ? sessaoVivaParaMidia(desta, sessoes ?? []) : null;

    const adapter = getAdapter(
      ((sessao?.provider as string) ?? DEFAULT_CHANNEL_PROVIDER) as ChannelProvider,
    );
    const sessionRef = sessao ? resolveSessionRef(sessao as unknown as ChannelSessionRef) : null;
    if (!adapter.fetchInboundMedia || !sessionRef) {
      return { consumer_key, status: "skipped", detail: "canal_sem_midia_de_entrada" };
    }

    media = await adapter.fetchInboundMedia({
      organizationId: msg.organization_id,
      sessionRef,
      url: msg.media_url ?? "",
      hintMime: msg.media_mime,
      messageExternalId: msg.external_id,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (isLastAttempt) {
      logger.error("[media-persist] download failed permanently", { message_id: msg.id, detail });
      await markStatus("failed");
    }
    return { consumer_key, status: "error", detail };
  }

  const path = storagePathFor(msg.organization_id, msg.conversation_id, msg.id, media.mime);
  const { error: uploadErr } = await admin.storage
    .from("whatsapp-media")
    .upload(path, media.buffer, { contentType: media.mime, upsert: true });
  if (uploadErr) {
    if (isLastAttempt) {
      logger.error("[media-persist] upload failed permanently", {
        message_id: msg.id,
        detail: uploadErr.message,
      });
      await markStatus("failed");
    }
    return { consumer_key, status: "error", detail: uploadErr.message };
  }

  await markStatus("stored", {
    media_storage_path: path,
    media_size_bytes: media.buffer.byteLength,
    media_mime: media.mime,
  });

  const { error: emitErr } = await admin.rpc("emit_event" as never, {
    p_event_type: "media.derive_requested",
    p_entity_kind: "message",
    p_entity_id: msg.id,
    p_payload: { message_id: msg.id },
    p_metadata: { source: "media_persist" },
    p_organization_id: msg.organization_id,
  } as never);
  if (emitErr)
    logger.warn("[media-persist] emit_event failed (non-blocking)", {
      message_id: msg.id,
      detail: emitErr.message,
    });

  return { consumer_key, status: "ok", media };
}
