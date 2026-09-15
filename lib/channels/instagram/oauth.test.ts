import { describe, expect, it } from "vitest";

import { emitirEstadoInstagram, verificarEstadoInstagram } from "./oauth-estado";
import {
  configuracaoDoAppMeta,
  montarUrlDeConsentimento,
  trocarCodigoPorConta,
} from "./oauth";

const SEGREDO = "segredo-de-teste-com-mais-de-16";

describe("configuracaoDoAppMeta", () => {
  it("sem id ou secret — ainda não somos um app", () => {
    expect(configuracaoDoAppMeta({ META_APP_ID: "123", META_APP_SECRET: "" })).toBeNull();
    expect(configuracaoDoAppMeta({ META_APP_ID: "", META_APP_SECRET: "s" })).toBeNull();
  });

  it("com os dois — dá para pedir o consentimento", () => {
    expect(configuracaoDoAppMeta({ META_APP_ID: "123", META_APP_SECRET: "s" })).toEqual(
      expect.objectContaining({ appId: "123", appSecret: "s" }),
    );
  });
});

describe("montarUrlDeConsentimento", () => {
  it("manda a pessoa para a Meta, não para o login do Instagram nosso", () => {
    const url = new URL(
      montarUrlDeConsentimento({
        app: { appId: "123", appSecret: "s", graphVersion: "v22.0" },
        redirectUri: "https://crm.exemplo.com/api/v1/channels/direct/oauth/callback",
        state: "abc",
      }),
    );
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("scope")).toMatch(/instagram_manage_messages/);
  });
});

describe("estado do consentimento", () => {
  it("volta a org de quem clicou e recusa lixo", () => {
    const agora = new Date("2026-09-15T14:00:00.000Z");
    const token = emitirEstadoInstagram(
      { organizationId: "org-1", userId: "user-1" },
      { segredo: SEGREDO, agora },
    );
    expect(verificarEstadoInstagram(token, { segredo: SEGREDO, agora })).toEqual(
      expect.objectContaining({ organizationId: "org-1", userId: "user-1" }),
    );
    expect(verificarEstadoInstagram("lixo", { segredo: SEGREDO, agora })).toBeNull();
  });
});

describe("trocarCodigoPorConta", () => {
  it("escolhe a Página que tem Instagram profissional", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes("oauth/access_token") && href.includes("code=")) {
        return Response.json({ access_token: "curto" });
      }
      if (href.includes("fb_exchange_token")) {
        return Response.json({ access_token: "longo" });
      }
      return Response.json({
        data: [
          { id: "page-sem-ig", access_token: "p1" },
          {
            id: "page-com-ig",
            access_token: "page-tok",
            instagram_business_account: { id: "17841400000", username: "moopetec" },
          },
        ],
      });
    };
    const r = await trocarCodigoPorConta({
      app: { appId: "123", appSecret: "s", graphVersion: "v22.0" },
      code: "code-1",
      redirectUri: "https://crm.exemplo.com/cb",
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(r).toEqual({
      accountId: "17841400000",
      username: "moopetec",
      token: "page-tok",
    });
  });

  it("sem Página ligada ao Instagram — não inventa conta", async () => {
    const fetchImpl = async (input: RequestInfo | URL) => {
      const href = String(input);
      if (href.includes("oauth/access_token")) {
        return Response.json({ access_token: "curto" });
      }
      return Response.json({ data: [{ id: "page", access_token: "p1" }] });
    };
    const r = await trocarCodigoPorConta({
      app: { appId: "123", appSecret: "s", graphVersion: "v22.0" },
      code: "code-1",
      redirectUri: "https://crm.exemplo.com/cb",
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(r).toEqual({ erro: "instagram_sem_pagina" });
  });
});
