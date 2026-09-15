/**
 * Bytes da mídia para a inbox. Sempre same-origin — o <audio>/<img>/<video>
 * não segue 302 para o Storage (origem diferente + nosniff) e o player
 * dispara "Mídia indisponível".
 *
 * 1. Se já está no bucket, baixa e devolve.
 * 2. Se não está, tenta persistir agora (o arquivo ainda pode existir no canal).
 * 3. Sem bytes: null. A rota vira 404, não JSON 502 no src do player.
 */
import { persistirMidiaDaMensagem } from "@/lib/messaging/media/persistir";
import type { FetchedMedia } from "@/lib/messaging/media/types";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MensagemComMidia {
  id: string;
  organization_id: string;
  media_url: string | null;
  media_mime: string | null;
  media_storage_path: string | null;
}

export async function servirBytesDaMidia(msg: MensagemComMidia): Promise<FetchedMedia | null> {
  const admin = createAdminClient();

  if (msg.media_storage_path) {
    const doBucket = await baixarDoBucket(admin, msg.media_storage_path, msg.media_mime);
    if (doBucket) return doBucket;
  }

  const persistido = await persistirMidiaDaMensagem({
    organizationId: msg.organization_id,
    messageId: msg.id,
    attempts: 0,
  });
  if (persistido.media) return persistido.media;

  if (persistido.status === "skipped" && persistido.detail === "already stored") {
    const { data: atual } = await admin
      .from("messages")
      .select("media_storage_path, media_mime")
      .eq("id", msg.id)
      .eq("organization_id", msg.organization_id)
      .maybeSingle();
    if (atual?.media_storage_path) {
      return baixarDoBucket(admin, atual.media_storage_path as string, atual.media_mime as string | null);
    }
  }

  return null;
}

async function baixarDoBucket(
  admin: ReturnType<typeof createAdminClient>,
  path: string,
  hintMime: string | null,
): Promise<FetchedMedia | null> {
  const { data, error } = await admin.storage.from("whatsapp-media").download(path);
  if (error || !data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.byteLength === 0) return null;
  const mime = hintMime || data.type || "application/octet-stream";
  return { buffer, mime };
}
