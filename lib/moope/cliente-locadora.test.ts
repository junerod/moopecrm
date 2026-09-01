import { describe, expect, it, vi } from "vitest";

import {
  canonicalDoGet,
  getRetratoLocatario,
  lookupLocatario,
  urlDaApiDaLocadora,
} from "@/lib/moope/cliente-locadora";

vi.mock("@/lib/webhooks/secrets", () => ({
  decryptWebhookSecret: vi.fn(async () => "segredo-saida"),
}));

function adminCom(conexao: Record<string, unknown> | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: conexao, error: null }),
            }),
          }),
        }),
      }),
    }),
  };
}

const CONN = {
  id: "cx",
  organization_id: "org-1",
  kind: "locadora",
  partner_webhook_url: "https://frota.exemplo/api/crm/events/9",
  partner_api_url: null,
  inbound_key_prefix: "mop_aa",
  inbound_key_hash: "hh",
  outbound_secret_enc: "\\x00",
  status: "active",
};

describe("urlDaApiDaLocadora", () => {
  it("campo explícito vence", () => {
    expect(
      urlDaApiDaLocadora({
        partner_api_url: "https://frota.exemplo/",
        partner_webhook_url: "https://outro/hooks",
      }),
    ).toBe("https://frota.exemplo");
  });

  it("sem campo, usa a origem do webhook", () => {
    expect(
      urlDaApiDaLocadora({
        partner_api_url: null,
        partner_webhook_url: "https://frota.exemplo/api/crm/events/9",
      }),
    ).toBe("https://frota.exemplo");
  });

  it("sem os dois, não inventa", () => {
    expect(urlDaApiDaLocadora({ partner_api_url: null, partner_webhook_url: null })).toBeNull();
  });
});

describe("lookupLocatario", () => {
  it("sem conexão locadora = sem_integracao — tool nem liga de verdade", async () => {
    const r = await lookupLocatario(adminCom(null) as never, "org-1", { phone: "+5511999998888" });
    expect(r).toEqual({ ok: false, codigo: "sem_integracao" });
  });

  it("telefone inválido não chama a locadora", async () => {
    const fetchFn = vi.fn();
    const r = await lookupLocatario(adminCom(CONN) as never, "org-1", { phone: "abc" }, { fetchFn });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("entrada_invalida");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("404 = não é cliente; não cria cadastro", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 404 }));
    const r = await lookupLocatario(
      adminCom(CONN) as never,
      "org-1",
      { phone: "+5511999998888" },
      { fetchFn },
    );
    expect(r).toEqual({ ok: false, codigo: "nao_encontrado" });
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/crm/locatario?phone=%2B5511999998888");
    expect(init.method).toBe("GET");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Moope-Signature"]?.startsWith("sha256=")).toBe(true);
    expect(url).not.toContain("mop_");
  });

  it("5xx = indisponível", async () => {
    const fetchFn = vi.fn(async () => new Response("boom", { status: 502 }));
    const r = await lookupLocatario(
      adminCom(CONN) as never,
      "org-1",
      { cpf: "123.456.789-09" },
      { fetchFn },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.codigo).toBe("indisponivel");
  });

  it("200 devolve o que a locadora já tem", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ locatario_id: "loc-1", nome: "João", contrato_status: "ativo" }),
          { status: 200 },
        ),
    );
    const r = await lookupLocatario(
      adminCom({ ...CONN, partner_api_url: "https://frota.exemplo" }) as never,
      "org-1",
      { phone: "+5511999998888" },
      { fetchFn },
    );
    expect(r).toEqual({
      ok: true,
      locatario_id: "loc-1",
      nome: "João",
      contrato_status: "ativo",
    });
  });
});

describe("getRetratoLocatario", () => {
  it("lê URLs que já existem; não inventa boleto", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            nome: "João",
            placa: "ABC1D23",
            faixa: "atraso",
            amount_cents: 89000,
            boleto_url: "https://asaas.exemplo/b/1",
          }),
          { status: 200 },
        ),
    );
    const r = await getRetratoLocatario(adminCom(CONN) as never, "org-1", "loc-1", { fetchFn });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.placa).toBe("ABC1D23");
      expect(r.boleto_url).toBe("https://asaas.exemplo/b/1");
      expect(r.portal_url).toBeNull();
    }
  });
});

describe("canonicalDoGet", () => {
  it("é método + path + query, sem body", () => {
    const u = new URL("https://frota.exemplo/api/crm/locatario?phone=%2B5511");
    expect(canonicalDoGet(u)).toBe("GET\n/api/crm/locatario?phone=%2B5511");
  });
});
