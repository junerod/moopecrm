/**
 * Assinatura e leitura do webhook da API hospedada.
 *
 * PURO: sem banco. A assinatura é HMAC-SHA1 do URL + params ordenados,
 * chave = auth token da conta (não o segredo que nós geramos).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function parseFormBody(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(raw);
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export function verifyTwilioSignature(
  rawBody: string,
  headerValue: string | null,
  authToken: string,
  requestUrl: string,
): boolean {
  if (!authToken || !headerValue || !requestUrl) return false;
  const params = parseFormBody(rawBody);
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], requestUrl);
  const expected = createHmac("sha1", authToken).update(data, "utf8").digest("base64");
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export type TwilioEventKind = "message" | "status";

export interface TwilioInbound {
  kind: TwilioEventKind;
  direction: "inbound" | "outbound";
  externalId: string;
  status?: "sent" | "delivered" | "read" | "failed";
  errorReason?: string | null;
  text: string | null;
  fromDigits: string | null;
  toDigits: string | null;
  profileName: string | null;
  mediaUrl: string | null;
  mediaMime: string | null;
}

function digitsWhatsApp(raw: string | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/^whatsapp:/i, "").replace(/\D/g, "");
  return d.length > 0 ? d : null;
}

function mapStatus(raw: string | undefined): "sent" | "delivered" | "read" | "failed" | null {
  const s = (raw ?? "").toLowerCase();
  if (s === "delivered") return "delivered";
  if (s === "read") return "read";
  if (s === "failed" || s === "undelivered") return "failed";
  if (s === "sent" || s === "queued" || s === "accepted") return "sent";
  return null;
}

export function parseTwilioInbound(rawBody: string): TwilioInbound | null {
  const p = parseFormBody(rawBody);
  const sid = p.MessageSid || p.SmsSid || p.SmsMessageSid;
  if (!sid) return null;

  const status = mapStatus(p.MessageStatus || p.SmsStatus);
  const temCorpo = Boolean(p.Body && p.Body.length > 0);
  const temMidia = Number(p.NumMedia ?? "0") > 0;

  if ((status === "failed" || status === "delivered" || status === "read") && !temCorpo && !temMidia) {
    return {
      kind: "status",
      direction: "outbound",
      externalId: sid,
      status,
      errorReason: p.ErrorMessage || p.ErrorCode || null,
      text: null,
      fromDigits: digitsWhatsApp(p.From),
      toDigits: digitsWhatsApp(p.To),
      profileName: null,
      mediaUrl: null,
      mediaMime: null,
    };
  }

  if (!temCorpo && !temMidia) return null;

  return {
    kind: "message",
    direction: "inbound",
    externalId: sid,
    text: temCorpo ? (p.Body ?? null) : null,
    fromDigits: digitsWhatsApp(p.From) ?? digitsWhatsApp(p.WaId),
    toDigits: digitsWhatsApp(p.To),
    profileName: p.ProfileName || null,
    mediaUrl: temMidia ? p.MediaUrl0 || null : null,
    mediaMime: temMidia ? p.MediaContentType0 || null : null,
  };
}
