import { describe, expect, it } from "vitest";

import {
  emitirEstadoInstagram,
  normalizarArrobaInstagram,
  verificarEstadoInstagram,
} from "./oauth-estado";
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

  it("o id do produto Instagram ganha do id pai do Facebook", () => {
    expect(
      configuracaoDoAppMeta({
        META_APP_ID: "pai",
        META_APP_SECRET: "segredo-pai",
        META_INSTAGRAM_APP_ID: "ig",
        META_INSTAGRAM_APP_SECRET: "segredo-ig",
      }),
    ).toEqual(expect.objectContaining({ appId: "ig", appSecret: "segredo-ig" }));
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
    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.searchParams.get("client_id")).toBe("123");
    expect(url.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_manage_messages",
    );
    expect(url.searchParams.get("scope")).not.toMatch(/pages_/);
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
      expect.objectContaining({
        organizationId: "org-1",
        userId: "user-1",
        contaEsperada: null,
      }),
    );
    expect(verificarEstadoInstagram("lixo", { segredo: SEGREDO, agora })).toBeNull();
  });

  it("guarda o @ que a pessoa digitou", () => {
    const agora = new Date("2026-09-15T14:00:00.000Z");
    const token = emitirEstadoInstagram(
      { organizationId: "org-1", userId: "user-1", contaEsperada: "@MoopeTec" },
      { segredo: SEGREDO, agora },
    );
    expect(verificarEstadoInstagram(token, { segredo: SEGREDO, agora })?.contaEsperada).toBe(
      "moopetec",
    );
  });
});

describe("normalizarArrobaInstagram", () => {
  it("aceita o @ que o operador conhece e recusa lixo", () => {
    expect(normalizarArrobaInstagram("@MoopeTec")).toBe("moopetec");
    expect(normalizarArrobaInstagram("  moopetec  ")).toBe("moopetec");
    expect(normalizarArrobaInstagram("não é @")).toBeNull();
    expect(normalizarArrobaInstagram("")).toBeNull();
  });
});

describe("trocarCodigoPorConta", () => {
  it("troca o código pela conta do Instagram Login", async () => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (href.includes("api.instagram.com/oauth/access_token") && init?.method === "POST") {
        return Response.json({ access_token: "curto", user_id: "17841400000" });
      }
      if (href.includes("ig_exchange_token")) {
        return Response.json({ access_token: "longo" });
      }
      return Response.json({ user_id: "17841400000", username: "moopetec" });
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
      token: "longo",
    });
  });

  it("sem id da conta — não inventa", async () => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (href.includes("api.instagram.com") && init?.method === "POST") {
        return Response.json({ access_token: "curto" });
      }
      if (href.includes("ig_exchange_token")) {
        return Response.json({ access_token: "longo" });
      }
      return Response.json({ username: "x" });
    };
    const r = await trocarCodigoPorConta({
      app: { appId: "123", appSecret: "s", graphVersion: "v22.0" },
      code: "code-1",
      redirectUri: "https://crm.exemplo.com/cb",
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(r).toEqual({ erro: "instagram_sem_pagina" });
  });

  it("com @ esperado diferente — recusa", async () => {
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit) => {
      const href = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (href.includes("api.instagram.com") && init?.method === "POST") {
        return Response.json({ access_token: "curto", user_id: "1" });
      }
      if (href.includes("ig_exchange_token")) {
        return Response.json({ access_token: "longo" });
      }
      return Response.json({ user_id: "1", username: "outra" });
    };
    const r = await trocarCodigoPorConta({
      app: { appId: "123", appSecret: "s", graphVersion: "v22.0" },
      code: "code-1",
      redirectUri: "https://crm.exemplo.com/cb",
      usernameEsperado: "@moopetec",
      fetchImpl: fetchImpl as typeof fetch,
    });
    expect(r).toEqual({ erro: "conta_diferente" });
  });
});
