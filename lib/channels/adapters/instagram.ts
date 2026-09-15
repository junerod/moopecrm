/**
 * Adapter do Direct — traduz formato e nada mais.
 *
 * Endereço é o IGSID (thread), não telefone. Sem `igsid:` no contato e sem
 * `providerConversationId` não há para quem mandar.
 */
import { createAdminClient } from "@/lib/supabase/admin";

import { CHANNEL_PROVIDER_INSTAGRAM } from "../capabilities";
import { resolveDirectCreds } from "../instagram/credentials";
import type { ChannelAdapter, OutboundEnvelope, RecipientInput } from "../types";

function igsidDe(input: RecipientInput, envelope?: OutboundEnvelope): string | null {
  if (envelope?.providerConversationId) return envelope.providerConversationId;
  const id = input.waIdentity ?? "";
  return id.startsWith("igsid:") ? id.slice("igsid:".length) : null;
}

export const instagramAdapter: ChannelAdapter = {
  provider: CHANNEL_PROVIDER_INSTAGRAM,

  resolveRecipient(input: RecipientInput): string | null {
    return igsidDe(input);
  },

  isConfigured(): boolean {
    return true;
  },

  codes: {
    notConfigured: "direct_not_configured",
    sendFailed: "direct_send_failed",
    unknownError: "direct_unknown_error",
  },

  async send(envelope: OutboundEnvelope): Promise<{ externalId: string | null }> {
    const creds = await resolveDirectCreds(createAdminClient(), {
      organizationId: envelope.organizationId,
      accountId: envelope.sessionRef,
    });
    if (!creds) {
      throw new Error(
        "direct_not_configured: nenhuma credencial para esta conta (nem na sessão, nem no ambiente).",
      );
    }

    const to = envelope.providerConversationId ?? envelope.to;
    if (!to) {
      throw new Error("direct_send_failed: sem destinatário (IGSID).");
    }

    const corpo =
      envelope.kind === "text"
        ? { text: envelope.body ?? "" }
        : envelope.media
          ? { attachment: { type: "image", payload: { url: envelope.media.url } } }
          : { text: envelope.body ?? "" };

    const res = await fetch(
      `https://graph.facebook.com/${creds.graphVersion}/${encodeURIComponent(creds.accountId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipient: { id: to }, message: corpo }),
      },
    );
    const body = (await res.json().catch(() => ({}))) as {
      message_id?: string;
      error?: { message?: string };
    };
    if (!res.ok || body.error) {
      throw new Error(
        `direct_send_failed: ${body.error?.message ?? `http_${res.status}`}`,
      );
    }
    return { externalId: body.message_id ?? null };
  },
};
