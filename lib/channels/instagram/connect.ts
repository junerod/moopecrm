/**
 * Conectar o Direct — validar a conta e gravar a sessão.
 *
 * A tela pede o id da conta profissional. O token pode vir no formulário ou
 * da sessão oficial já gravada (mesmo app). Sem um dos dois, conectar
 * mentiria: a aba ficaria "pronta" e a DM nunca chegaria.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/webhooks/secrets";

import { ARCHIVED_AT, queryTolerantToMissingArchived } from "../archived";
import { CHANNEL_PROVIDER_INSTAGRAM, CHANNEL_PROVIDER_META } from "../capabilities";
import { metaPodeReceber } from "../meta/webhook";
import { reactivateChannelSession } from "../reactivate";
import { configuracaoDoAppMeta } from "./oauth";

export const DIRECT_CHANNEL_LABEL = "Instagram";

export type DirectValidation =
  | { ok: true; accountId: string; username: string | null }
  | { ok: false; reason: string };

export async function validateDirectCredentials(input: {
  accountId: string;
  token: string;
}): Promise<DirectValidation> {
  const accountId = input.accountId.trim();
  const token = input.token.trim();
  if (!accountId) return { ok: false, reason: "Informe o id da conta profissional." };
  if (!token) return { ok: false, reason: "Informe o token do app, ou conecte a API oficial antes." };

  const version = process.env.META_GRAPH_VERSION ?? "v22.0";
  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${encodeURIComponent(accountId)}?fields=id,username,name`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      username?: string;
      name?: string;
      error?: { message?: string };
    };
    if (!res.ok || body.error) {
      return { ok: false, reason: body.error?.message ?? `Provedor respondeu ${res.status}.` };
    }
    return {
      ok: true,
      accountId: body.id ?? accountId,
      username: body.username ?? body.name ?? null,
    };
  } catch {
    return { ok: false, reason: "Não foi possível falar com o provedor. Tente de novo." };
  }
}

export async function tokenOficialDaOrg(
  admin: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const env = (process.env.META_SYSTEM_USER_TOKEN ?? "").trim();
  const base = () =>
    admin
      .from("channel_sessions")
      .select("meta_token_encrypted")
      .eq("organization_id", organizationId)
      .eq("provider", CHANNEL_PROVIDER_META);
  const { data } = await queryTolerantToMissingArchived(
    () => base().is(ARCHIVED_AT, null).maybeSingle(),
    () => base().maybeSingle(),
  );
  const cifrado = data?.meta_token_encrypted;
  if (cifrado) {
    const token = await decryptWebhookSecret(admin, cifrado as unknown as string);
    if (token) return token;
  }
  return env || null;
}

export interface DirectSessionState {
  connected: boolean;
  podeReceber: boolean;
  /** Dá para abrir o consentimento da Meta — o CRM vira um app autorizado. */
  podeConectarComoApp: boolean;
  hasToken: boolean;
  accountId: string | null;
  displayName: string | null;
  status: string | null;
  webhook: { callbackUrl: string; verifyToken: string | null } | null;
}

export async function estadoDoDirect(
  admin: SupabaseClient,
  organizationId: string,
  publicBase: string,
): Promise<DirectSessionState> {
  const consultar = (provider: string, colunas: string) =>
    admin
      .from("channel_sessions")
      .select(colunas)
      .eq("organization_id", organizationId)
      .eq("provider", provider);

  const { data: diretaRaw } = await queryTolerantToMissingArchived(
    () =>
      consultar(
        CHANNEL_PROVIDER_INSTAGRAM,
        "instagram_account_id, display_name, status, webhook_path_token, meta_token_encrypted",
      )
        .is(ARCHIVED_AT, null)
        .maybeSingle(),
    () =>
      consultar(
        CHANNEL_PROVIDER_INSTAGRAM,
        "instagram_account_id, display_name, status, webhook_path_token, meta_token_encrypted",
      ).maybeSingle(),
  );
  const direta = diretaRaw as Record<string, unknown> | null;

  const { data: oficialRaw } = await queryTolerantToMissingArchived(
    () =>
      consultar(CHANNEL_PROVIDER_META, "webhook_path_token")
        .is(ARCHIVED_AT, null)
        .maybeSingle(),
    () => consultar(CHANNEL_PROVIDER_META, "webhook_path_token").maybeSingle(),
  );
  const oficial = oficialRaw as Record<string, unknown> | null;

  const tokenPath =
    (oficial?.webhook_path_token as string | undefined) ??
    (direta?.webhook_path_token as string | undefined) ??
    null;

  return {
    connected: Boolean(direta),
    podeReceber: metaPodeReceber(),
    podeConectarComoApp: configuracaoDoAppMeta() !== null,
    hasToken: Boolean(direta?.meta_token_encrypted),
    accountId: (direta?.instagram_account_id as string | undefined) ?? null,
    displayName: (direta?.display_name as string | undefined) ?? null,
    status: (direta?.status as string | undefined) ?? null,
    webhook: tokenPath
      ? {
          callbackUrl: `${publicBase}/api/v1/webhooks/meta/${tokenPath}`,
          verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN ?? null,
        }
      : null,
  };
}

export async function gravarSessaoDirect(
  admin: SupabaseClient,
  input: {
    organizationId: string;
    accountId: string;
    username: string | null;
    token: string;
    userId: string;
    requestId: string;
  },
): Promise<{ error: string | null }> {
  const cifrado = await encryptWebhookSecret(admin, input.token);
  if (!cifrado) {
    return {
      error:
        "cifra indisponível nesta instalação (GUC app.nuvemshop_oauth_key ausente) — o token não foi gravado",
    };
  }

  const buscar = (colunas: string) =>
    admin
      .from("channel_sessions")
      .select(colunas)
      .eq("organization_id", input.organizationId)
      .eq("provider", CHANNEL_PROVIDER_INSTAGRAM)
      .maybeSingle();
  const { data: existenteRaw } = await queryTolerantToMissingArchived(
    () => buscar(`id, ${ARCHIVED_AT}`),
    () => buscar("id"),
  );
  const existente = existenteRaw as { id: string; archived_at?: string | null } | null;

  const linha = {
    organization_id: input.organizationId,
    provider: CHANNEL_PROVIDER_INSTAGRAM,
    instagram_account_id: input.accountId,
    meta_token_encrypted: cifrado,
    display_name: input.username ? `@${input.username}` : DIRECT_CHANNEL_LABEL,
    status: "WORKING" as const,
  };

  const { error } = existente
    ? await reactivateChannelSession(
        admin,
        {
          organizationId: input.organizationId,
          channelSessionId: existente.id,
          archivedAt: existente.archived_at ?? null,
        },
        linha,
        {
          userId: input.userId,
          requestId: input.requestId,
          metadata: { provider: CHANNEL_PROVIDER_INSTAGRAM, account_id: input.accountId },
        },
      )
    : await admin
        .from("channel_sessions")
        .insert({ ...linha, webhook_secret_encrypted: cifrado } as never);

  return { error: error?.message ?? null };
}
