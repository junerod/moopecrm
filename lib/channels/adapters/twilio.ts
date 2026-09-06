/**
 * Adapter do canal hospedado — Cloud API via ContentSid / texto.
 *
 * Endereça por telefone (E.164). Template = ContentSid no `name`.
 */
import { createAdminClient } from "@/lib/supabase/admin";

import type {
  ChannelAdapter,
  ChannelHealth,
  ChannelTenantScope,
  OutboundEnvelope,
  RecipientInput,
} from "../types";
import { twilioAccountHealth, twilioSendMessage } from "../twilio/client";
import { resolveTwilioCreds, twilioDigits } from "../twilio/credentials";

function toDigits(input: RecipientInput): string | null {
  if (input.isGroup) return null;
  const doIdentity = input.waIdentity?.startsWith("phone:")
    ? input.waIdentity.slice("phone:".length)
    : null;
  const bruto = doIdentity ?? input.phoneNumber ?? null;
  if (!bruto) return null;
  const d = twilioDigits(bruto);
  return d.length > 0 ? d : null;
}

export const twilioAdapter: ChannelAdapter = {
  provider: "twilio",

  resolveRecipient(input: RecipientInput): string | null {
    return toDigits(input);
  },

  isConfigured(): boolean {
    return true;
  },

  codes: {
    notConfigured: "twilio_not_configured",
    sendFailed: "twilio_send_failed",
    unknownError: "twilio_error",
  },

  async send(envelope: OutboundEnvelope): Promise<{ externalId: string | null }> {
    if (envelope.kind === "contact") {
      throw new Error("twilio_contact_not_supported: cartão de contato não sai neste canal.");
    }
    const admin = createAdminClient();
    const creds = await resolveTwilioCreds(admin, {
      organizationId: envelope.organizationId,
      fromDigits: envelope.sessionRef,
    });
    if (!creds) {
      throw new Error(
        "twilio_not_configured: nenhuma credencial para este número (nem na sessão, nem no ambiente).",
      );
    }
    if (envelope.media) {
      throw new Error("twilio_media_not_supported: mídia outbound ainda não sai por este canal.");
    }
    const { sid } = await twilioSendMessage(creds, {
      toDigits: twilioDigits(envelope.to),
      body: envelope.body ?? "",
    });
    return { externalId: sid };
  },

  async sendTemplate(input: ChannelTenantScope & {
    sessionRef: string;
    to: string;
    name: string;
    language: string;
    values: Record<string, string>;
  }): Promise<{ externalId: string | null }> {
    const admin = createAdminClient();
    const creds = await resolveTwilioCreds(admin, {
      organizationId: input.organizationId,
      fromDigits: input.sessionRef,
    });
    if (!creds) {
      throw new Error("twilio_not_configured: sem credencial para enviar o modelo.");
    }
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.values)) {
      const n = /^\d+$/.test(k) ? k : k.replace(/^body_/, "");
      if (/^\d+$/.test(n)) vars[n] = v;
    }
    const { sid } = await twilioSendMessage(creds, {
      toDigits: twilioDigits(input.to),
      contentSid: input.name,
      contentVariables: vars,
    });
    return { externalId: sid };
  },

  async checkHealth(input: ChannelTenantScope & { sessionRef: string }): Promise<ChannelHealth> {
    const admin = createAdminClient();
    const creds = await resolveTwilioCreds(admin, {
      organizationId: input.organizationId,
      fromDigits: input.sessionRef,
    });
    if (!creds) {
      return { reachable: true, status: "FAILED", detail: "sem credencial" };
    }
    return twilioAccountHealth(creds);
  },
};
