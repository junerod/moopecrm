/**
 * Credencial do Direct — token da Graph API, por sessão.
 *
 * Reusa `meta_token_encrypted`: o transporte é o mesmo app. Coluna nova
 * só para o sessionRef (`instagram_account_id`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptWebhookSecret } from "@/lib/webhooks/secrets";

import { ARCHIVED_AT, queryTolerantToMissingArchived } from "../archived";
import { CHANNEL_PROVIDER_INSTAGRAM } from "../capabilities";

export interface DirectCredentials {
  accountId: string;
  token: string;
  graphVersion: string;
  source: "session" | "env";
}

function graphVersion(): string {
  return process.env.META_GRAPH_VERSION ?? "v22.0";
}

function tokenDoEnv(): string | null {
  const token = (process.env.META_SYSTEM_USER_TOKEN ?? "").trim();
  return token || null;
}

export function directCredsFromEnv(): boolean {
  return tokenDoEnv() !== null;
}

export async function resolveDirectCreds(
  admin: SupabaseClient,
  lookup: { organizationId: string; accountId: string },
): Promise<DirectCredentials | null> {
  if (!lookup.organizationId || !lookup.accountId) return null;

  const base = () =>
    admin
      .from("channel_sessions")
      .select("instagram_account_id, meta_token_encrypted")
      .eq("organization_id", lookup.organizationId)
      .eq("provider", CHANNEL_PROVIDER_INSTAGRAM)
      .eq("instagram_account_id", lookup.accountId);
  const { data, error } = await queryTolerantToMissingArchived(
    () => base().is(ARCHIVED_AT, null).maybeSingle(),
    () => base().maybeSingle(),
  );
  if (error) {
    throw new Error(
      `direct_creds_lookup_failed: ${error.code ?? "sem_codigo"} ${error.message ?? ""}`.trim(),
    );
  }

  const cifrado = data?.meta_token_encrypted;
  if (data && cifrado) {
    const token = await decryptWebhookSecret(admin, cifrado as unknown as string);
    if (token) {
      return {
        accountId: data.instagram_account_id as string,
        token,
        graphVersion: graphVersion(),
        source: "session",
      };
    }
  }

  const env = tokenDoEnv();
  if (!env) return null;
  return {
    accountId: lookup.accountId,
    token: env,
    graphVersion: graphVersion(),
    source: "env",
  };
}
