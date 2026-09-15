/**
 * Consentimento da Meta — Instagram Login, não o diálogo velho do Facebook.
 *
 * O app criado pelo caso de uso Instagram só conhece
 * `instagram_business_*`. Pedir `pages_*` / `instagram_basic` a Meta
 * recusa com Invalid Scopes. Authenticator e senha ficam na Meta.
 */
import { normalizarArrobaInstagram } from "./oauth-estado";

export const ESCOPOS_DO_INSTAGRAM = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
] as const;

export const COOKIE_DO_RETORNO_INSTAGRAM = "dc_ig_oauth";

export interface AppMeta {
  appId: string;
  appSecret: string;
  graphVersion: string;
}

export function configuracaoDoAppMeta(
  source: Record<string, string | undefined> = process.env,
): AppMeta | null {
  const appId = (source.META_INSTAGRAM_APP_ID ?? source.META_APP_ID ?? "").trim();
  const appSecret = (source.META_INSTAGRAM_APP_SECRET ?? source.META_APP_SECRET ?? "").trim();
  if (!appId || !appSecret) return null;
  return {
    appId,
    appSecret,
    graphVersion: (source.META_GRAPH_VERSION ?? "v22.0").trim() || "v22.0",
  };
}

export function montarUrlDeConsentimento(input: {
  app: AppMeta;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", input.app.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ESCOPOS_DO_INSTAGRAM.join(","));
  return url.toString();
}

export interface ContaInstagramAutorizada {
  accountId: string;
  username: string | null;
  token: string;
}

export async function trocarCodigoPorConta(input: {
  app: AppMeta;
  code: string;
  redirectUri: string;
  usernameEsperado?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<ContaInstagramAutorizada | { erro: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const curto = await pedirToken(fetchImpl, input.app, input.code, input.redirectUri);
  if ("erro" in curto) return curto;

  const longo = await alongarToken(fetchImpl, input.app, curto.token);
  const token = "erro" in longo ? curto.token : longo.token;

  const res = await fetchImpl(
    `https://graph.instagram.com/${input.app.graphVersion}/me?fields=user_id,username`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const body = (await res.json().catch(() => ({}))) as {
    user_id?: string;
    id?: string;
    username?: string;
    error?: { message?: string };
  };
  if (!res.ok || body.error) {
    return { erro: body.error?.message ?? `http_${res.status}` };
  }

  const accountId = (body.user_id ?? body.id ?? "").trim();
  if (!accountId) return { erro: "instagram_sem_pagina" };

  const username = body.username ?? null;
  const esperado = normalizarArrobaInstagram(input.usernameEsperado);
  if (esperado && normalizarArrobaInstagram(username) !== esperado) {
    return { erro: "conta_diferente" };
  }

  return { accountId, username, token };
}

async function pedirToken(
  fetchImpl: typeof fetch,
  app: AppMeta,
  code: string,
  redirectUri: string,
): Promise<{ token: string; userId?: string } | { erro: string }> {
  const res = await fetchImpl("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: app.appId,
      client_secret: app.appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    user_id?: string | number;
    error?: { message?: string };
    error_message?: string;
  };
  if (!body.access_token) {
    return { erro: body.error?.message ?? body.error_message ?? `http_${res.status}` };
  }
  return { token: body.access_token, userId: body.user_id ? String(body.user_id) : undefined };
}

async function alongarToken(
  fetchImpl: typeof fetch,
  app: AppMeta,
  curto: string,
): Promise<{ token: string } | { erro: string }> {
  const url = new URL("https://graph.instagram.com/access_token");
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", app.appSecret);
  url.searchParams.set("access_token", curto);
  const res = await fetchImpl(url);
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: { message?: string };
  };
  if (!body.access_token) {
    return { erro: body.error?.message ?? `http_${res.status}` };
  }
  return { token: body.access_token };
}
