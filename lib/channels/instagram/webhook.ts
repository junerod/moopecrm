/**
 * Webhook do Direct — parse puro, sem banco.
 *
 * O envelope NÃO é o da Cloud API de WhatsApp. Vem `object: "instagram"` e
 * `entry[].messaging[]` (o fio do Messenger), não `changes[].value.messages`.
 * Reusar o parser do WhatsApp devolve lista vazia: a DM chega, a rota responde
 * 200 e nada entra na Inbox.
 *
 * Evento que não nos interessa é IGNORADO, não erro — a plataforma reentrega
 * o que não recebe 2xx.
 */
import type { MetaWebhookEnvelope } from "@/lib/channels/meta/envelope";

export interface DirectInboundEvent {
  kind: "inbound_message";
  accountId: string;
  from: string;
  username: string | null;
  externalId: string;
  text: string | null;
  sentAt: Date;
  referral: unknown;
}

export interface DirectEchoEvent {
  kind: "echo";
  externalId: string;
}

export type DirectWebhookEvent = DirectInboundEvent | DirectEchoEvent;

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Messenger manda ms; alguns apps mandam segundos. 1e12 ≈ 2001-09-09 em ms. */
function dataDaMarca(ts: number): Date {
  if (!Number.isFinite(ts) || ts <= 0) return new Date();
  return new Date(ts > 1e12 ? ts : ts * 1000);
}

/** O envelope é do Direct? WhatsApp e resto devolvem false — não é erro. */
export function envelopeEhDirect(envelope: MetaWebhookEnvelope): boolean {
  return envelope.object === "instagram";
}

export function parseDirectWebhook(envelope: MetaWebhookEnvelope): DirectWebhookEvent[] {
  if (!envelopeEhDirect(envelope)) return [];
  const out: DirectWebhookEvent[] = [];

  for (const entry of envelope.entry ?? []) {
    const accountId = str(entry.id) ?? "";
    const raw = entry as Record<string, unknown>;
    const messaging = Array.isArray(raw.messaging) ? raw.messaging : [];

    for (const item of messaging) {
      const row = obj(item);
      if (!row) continue;
      const message = obj(row.message);
      if (!message) continue;

      const mid = str(message.mid);
      if (!mid) continue;

      if (message.is_echo === true) {
        out.push({ kind: "echo", externalId: mid });
        continue;
      }

      const sender = obj(row.sender);
      const from = str(sender?.id);
      if (!from) continue;

      out.push({
        kind: "inbound_message",
        accountId,
        from,
        username: str(obj(row.sender)?.username) ?? str(message.username),
        externalId: mid,
        text: str(message.text),
        sentAt: dataDaMarca(
          typeof row.timestamp === "number" ? row.timestamp : Number(str(row.timestamp) ?? "0"),
        ),
        referral: row.referral ?? message.referral ?? null,
      });
    }
  }

  return out;
}
