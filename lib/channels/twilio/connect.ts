/**
 * Validar e gravar a conexão hospedada — do lado de dentro do seam.
 *
 * A tela pede SID, token e número. A rota não nomeia o provedor.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ARCHIVED_AT, queryTolerantToMissingArchived } from "../archived";
import { CHANNEL_PROVIDER_TWILIO } from "../capabilities";
import type { ChannelProvider } from "../types";
import { twilioApiBase, twilioDigits } from "./credentials";

export const HOSTED_CHANNEL_PROVIDER: ChannelProvider = CHANNEL_PROVIDER_TWILIO;
/** Rótulo da tela — sem o nome do provedor (invariante 1). */
export const HOSTED_CHANNEL_LABEL = "API de mensagens";

export interface HostedCredentialsInput {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export type HostedValidation =
  | { ok: true; phoneNumber: string; displayName: string }
  | { ok: false; reason: string };

export async function validateHostedCredentials(
  input: HostedCredentialsInput,
): Promise<HostedValidation> {
  const accountSid = input.accountSid.trim();
  const authToken = input.authToken.trim();
  const fromDigits = twilioDigits(input.fromNumber);
  if (!accountSid || !authToken) return { ok: false, reason: "Informe a conta e o token." };
  if (fromDigits.length < 8) return { ok: false, reason: "Informe o número WhatsApp em E.164." };

  let res: Response;
  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    res = await fetch(`${twilioApiBase()}/2010-04-01/Accounts/${encodeURIComponent(accountSid)}.json`, {
      headers: { Authorization: `Basic ${auth}` },
    });
  } catch {
    return { ok: false, reason: "Não foi possível falar com o provedor. Tente de novo." };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, reason: "Conta ou token recusados pelo provedor." };
  }
  if (!res.ok) {
    return { ok: false, reason: `Provedor respondeu ${res.status}.` };
  }

  return {
    ok: true,
    phoneNumber: `+${fromDigits}`,
    displayName: HOSTED_CHANNEL_LABEL,
  };
}

export interface HostedSession {
  id: string;
  fromDigits: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  status: string | null;
  webhookPathToken: string | null;
  hasToken: boolean;
  archivedAt: string | null;
}

const COLUNAS =
  "id, twilio_from, phone_number, display_name, status, webhook_path_token, twilio_token_encrypted";

function toHosted(row: Record<string, unknown> | null): HostedSession | null {
  if (!row) return null;
  return {
    id: row.id as string,
    fromDigits: (row.twilio_from as string) ?? null,
    phoneNumber: (row.phone_number as string) ?? null,
    displayName: (row.display_name as string) ?? null,
    status: (row.status as string) ?? null,
    webhookPathToken: (row.webhook_path_token as string) ?? null,
    hasToken: !!row.twilio_token_encrypted,
    archivedAt: (row.archived_at as string) ?? null,
  };
}

export async function findHostedSession(
  admin: SupabaseClient,
  organizationId: string,
): Promise<HostedSession | null> {
  const buscar = (colunas: string) =>
    admin
      .from("channel_sessions")
      .select(colunas)
      .eq("organization_id", organizationId)
      .eq("provider", HOSTED_CHANNEL_PROVIDER)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  const { data } = await queryTolerantToMissingArchived(
    () => buscar(`${COLUNAS}, ${ARCHIVED_AT}`),
    () => buscar(COLUNAS),
  );
  return toHosted(data as Record<string, unknown> | null);
}

export async function saveHostedSession(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    existingId: string | null;
    fromDigits: string;
    accountSid: string;
    tokenEncrypted: string;
    webhookPathToken: string;
    webhookSecretEncrypted: string;
    phoneNumber: string;
    displayName: string;
  },
): Promise<{ error: string | null }> {
  const linha = {
    organization_id: input.organizationId,
    provider: HOSTED_CHANNEL_PROVIDER,
    twilio_from: input.fromDigits,
    twilio_account_sid: input.accountSid,
    twilio_token_encrypted: input.tokenEncrypted,
    webhook_path_token: input.webhookPathToken,
    webhook_secret_encrypted: input.webhookSecretEncrypted,
    phone_number: input.phoneNumber,
    display_name: input.displayName,
    status: "WORKING",
    archived_at: null,
  };

  const { error } = input.existingId
    ? await admin
        .from("channel_sessions")
        .update(linha)
        .eq("id", input.existingId)
        .eq("organization_id", input.organizationId)
    : await admin.from("channel_sessions").insert(linha);

  return { error: error?.message ?? null };
}
