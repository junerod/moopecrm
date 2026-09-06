/**
 * Credenciais do canal hospedado — por sessão, env como fallback.
 *
 * `sessionRef` é o número WhatsApp (dígitos). O Account SID autentica; dois
 * senders no mesmo SID teriam o mesmo SID e sessionRefs diferentes.
 * Filtro de organização à mão (issue #236).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ARCHIVED_AT, queryTolerantToMissingArchived } from "../archived";
import { decryptWebhookSecret } from "@/lib/webhooks/secrets";

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
  fromDigits: string;
  source: "session" | "env";
}

export interface TwilioCredsLookup {
  organizationId: string;
  fromDigits: string;
}

export function twilioApiBase(): string {
  return process.env.TWILIO_API_BASE_URL ?? "https://api.twilio.com";
}

/** Só dígitos. `whatsapp:+55 61 9…` → `55619…`. */
export function twilioDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function twilioWhatsAppAddress(digits: string): string {
  return `whatsapp:+${twilioDigits(digits)}`;
}

export function twilioCredsFromEnv(): TwilioCredentials | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid || !authToken || !from) return null;
  return {
    accountSid,
    authToken,
    fromDigits: twilioDigits(from),
    source: "env",
  };
}

export async function twilioCredsForFrom(
  admin: SupabaseClient,
  lookup: TwilioCredsLookup,
): Promise<TwilioCredentials | null> {
  const { organizationId, fromDigits } = lookup;
  if (!organizationId || !fromDigits) return null;

  const base = () =>
    admin
      .from("channel_sessions")
      .select("twilio_from, twilio_account_sid, twilio_token_encrypted")
      .eq("organization_id", organizationId)
      .eq("twilio_from", fromDigits);
  const { data, error } = await queryTolerantToMissingArchived(
    () => base().is(ARCHIVED_AT, null).maybeSingle(),
    () => base().maybeSingle(),
  );
  if (error) {
    throw new Error(
      `twilio_creds_lookup_failed: ${error.code ?? "sem_codigo"} ${error.message ?? ""}`.trim(),
    );
  }

  const cifrado = data?.twilio_token_encrypted;
  const sid = data?.twilio_account_sid;
  if (!data || !cifrado || !sid) return null;

  const authToken = await decryptWebhookSecret(admin, cifrado as unknown as string);
  if (!authToken) return null;

  return {
    accountSid: sid as string,
    authToken,
    fromDigits: data.twilio_from as string,
    source: "session",
  };
}

export async function resolveTwilioCreds(
  admin: SupabaseClient,
  lookup: TwilioCredsLookup,
): Promise<TwilioCredentials | null> {
  return (await twilioCredsForFrom(admin, lookup)) ?? twilioCredsFromEnv();
}
