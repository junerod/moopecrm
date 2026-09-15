/**
 * MediaSource do WAHA: baixa o binário hospedado pelo container WAHA.
 *
 * A URL anunciada no webhook NÃO é confiável nem correta: o HMAC é
 * best-effort (payload forjado é possível) e o WAHA anuncia seu endereço
 * INTERNO (ex.: localhost:3000 dentro do container, mapeado p/ 3030 no
 * host). Por isso o fetch é SEMPRE reconstruído sobre WAHA_API_BASE_URL,
 * aproveitando apenas path+query da URL anunciada — SSRF impossível por
 * construção (o host nunca vem do payload). A futura MetaMediaSource
 * implementa a mesma assinatura baixando via media_id + Graph API.
 */
import {
  MAX_MEDIA_BYTES,
  MediaTooLargeError,
  type FetchedMedia,
} from "@/lib/messaging/media/types";

import { chatIdFromWaMessageId } from "@/lib/waha/message-id";

const FETCH_TIMEOUT_MS = 30_000;
const PATH_ARQUIVO = /^\/api\/files\/([^/]+)\/(.+)$/;

/** Troca a pasta da sessão STOPPED pela WORKING — o arquivo às vezes já está lá. */
export function reescreverPathDaSessao(pathname: string, sessionRef: string): string | null {
  const m = pathname.match(PATH_ARQUIVO);
  if (!m) return null;
  if (m[1] === sessionRef) return null;
  return `/api/files/${sessionRef}/${m[2]}`;
}

function resolverUrl(mediaUrl: string): URL {
  const base = process.env.WAHA_API_BASE_URL;
  try {
    const advertised = new URL(mediaUrl);
    return new URL(advertised.pathname + advertised.search, base ?? "");
  } catch {
    throw new Error("waha_media_untrusted_host");
  }
}

async function baixar(url: URL, hintMime?: string | null): Promise<FetchedMedia> {
  const apiKey = process.env.WAHA_API_KEY;
  const res = await fetch(url.toString(), {
    headers: apiKey ? { "X-Api-Key": apiKey } : {},
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`waha_media_${res.status}`);

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_MEDIA_BYTES) throw new MediaTooLargeError();

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_MEDIA_BYTES) throw new MediaTooLargeError();

  const mime = res.headers.get("content-type") || hintMime || "application/octet-stream";
  return { buffer, mime };
}

export async function fetchWahaMedia(
  mediaUrl: string,
  hintMime?: string | null,
  sessionRef?: string | null,
): Promise<FetchedMedia> {
  const url = resolverUrl(mediaUrl);
  try {
    return await baixar(url, hintMime);
  } catch (err) {
    const detalhe = err instanceof Error ? err.message : String(err);
    if (!sessionRef || !detalhe.includes("404")) throw err;
    const alt = reescreverPathDaSessao(url.pathname, sessionRef);
    if (!alt) throw err;
    return baixar(new URL(alt + url.search, process.env.WAHA_API_BASE_URL ?? ""), hintMime);
  }
}

/**
 * Pede ao canal que baixe de novo do aparelho (downloadMedia=true).
 * O cache em /api/files some; o áudio continua no celular.
 */
export async function fetchWahaMediaDoAparelho(
  sessionRef: string,
  messageExternalId: string,
  hintMime?: string | null,
): Promise<FetchedMedia> {
  const base = process.env.WAHA_API_BASE_URL;
  if (!base) throw new Error("waha_media_sem_base");
  const chat = chatIdFromWaMessageId(messageExternalId);
  if (!chat) throw new Error("waha_media_sem_chat");

  const apiKey = process.env.WAHA_API_KEY;
  const url =
    `${base}/api/${encodeURIComponent(sessionRef)}/chats/` +
    `${encodeURIComponent(chat)}/messages/${encodeURIComponent(messageExternalId)}` +
    `?downloadMedia=true`;
  const res = await fetch(url, {
    headers: apiKey ? { "X-Api-Key": apiKey } : {},
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`waha_media_phone_${res.status}`);
  const json = (await res.json()) as {
    mediaUrl?: string | null;
    media?: { url?: string | null; mimetype?: string | null };
  };
  const nova = json.media?.url ?? json.mediaUrl ?? null;
  if (!nova) throw new Error("waha_media_phone_empty");
  return fetchWahaMedia(nova, hintMime ?? json.media?.mimetype ?? null, sessionRef);
}
