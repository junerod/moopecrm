/**
 * Consentimento da Meta — o CRM vira um app que a pessoa autoriza.
 *
 * Depois disto o CRM aparece em Contas › Conexões de apps. Authenticator,
 * senha e 2FA ficam na tela da Meta, nunca aqui.
 */
export const ESCOPOS_DO_INSTAGRAM = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_messaging",
  "instagram_basic",
  "instagram_manage_messages",
  "business_management",
] as const;

export interface AppMeta {
  appId: string;
  appSecret: string;
  graphVersion: string;
}

export function configuracaoDoAppMeta(
  source: Record<string, string | undefined> = process.env,
): AppMeta | null {
  const appId = (source.META_APP_ID ?? "").trim();
  const appSecret = (source.META_APP_SECRET ?? "").trim();
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
  const url = new URL(`https://www.facebook.com/${input.app.graphVersion}/dialog/oauth`);
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
  fetchImpl?: typeof fetch;
}): Promise<ContaInstagramAutorizada | { erro: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const curto = await pedirToken(fetchImpl, input.app, {
    code: input.code,
    redirect_uri: input.redirectUri,
  });
  if ("erro" in curto) return curto;

  const longo = await alongarToken(fetchImpl, input.app, curto.token);
  const userToken = "erro" in longo ? curto.token : longo.token;

  const res = await fetchImpl(
    `https://graph.facebook.com/${input.app.graphVersion}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username}`,
    { headers: { Authorization: `Bearer ${userToken}` } },
  );
  const body = (await res.json().catch(() => ({}))) as {
    data?: Array<{
      access_token?: string;
      instagram_business_account?: { id?: string; username?: string };
    }>;
    error?: { message?: string };
  };
  if (!res.ok || body.error) {
    return { erro: body.error?.message ?? `http_${res.status}` };
  }

  for (const pagina of body.data ?? []) {
    const ig = pagina.instagram_business_account;
    if (ig?.id && pagina.access_token) {
      return {
        accountId: ig.id,
        username: ig.username ?? null,
        token: pagina.access_token,
      };
    }
  }
  return { erro: "instagram_sem_pagina" };
}

async function pedirToken(
  fetchImpl: typeof fetch,
  app: AppMeta,
  params: Record<string, string>,
): Promise<{ token: string } | { erro: string }> {
  const url = new URL(`https://graph.facebook.com/${app.graphVersion}/oauth/access_token`);
  url.searchParams.set("client_id", app.appId);
  url.searchParams.set("client_secret", app.appSecret);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
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

async function alongarToken(
  fetchImpl: typeof fetch,
  app: AppMeta,
  curto: string,
): Promise<{ token: string } | { erro: string }> {
  return pedirToken(fetchImpl, app, {
    grant_type: "fb_exchange_token",
    fb_exchange_token: curto,
  });
}
