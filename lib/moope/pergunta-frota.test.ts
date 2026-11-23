import { describe, expect, it, vi } from "vitest";

import { blocoDaPerguntaDeFrota, lerPerguntaDeFrota } from "@/lib/moope/pergunta-frota";

vi.mock("@/lib/webhooks/secrets", () => ({
  decryptWebhookSecret: vi.fn(async () => "segredo-teste"),
}));

const HOJE = new Date(2026, 10, 23);

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
  partner_webhook_url: "https://gestao.exemplo/api/crm/events/9",
  partner_api_url: "https://gestao.exemplo",
  inbound_key_prefix: "mop_aa",
  inbound_key_hash: "hh",
  outbound_secret_enc: "\\x00",
  status: "active",
};

describe("pergunta de carro na mensagem", () => {
  it("lê a Saveiro e o período 28/11 a 30/11", () => {
    const p = lerPerguntaDeFrota("a Saveiro está livre de 28/11 a 30/11?", HOJE);
    expect(p).toMatchObject({
      q: "Saveiro",
      inicio: "2026-11-28",
      fim: "2026-11-30",
      querDisponibilidade: true,
    });
  });

  it("lê o preço mensal sem inventar data", () => {
    const p = lerPerguntaDeFrota("quanto fica a Saveiro no mês?", HOJE);
    expect(p).toMatchObject({
      q: "Saveiro",
      inicio: null,
      fim: null,
      querPreco: true,
      querDisponibilidade: false,
    });
  });

  it("cumprimento não vira consulta", () => {
    expect(lerPerguntaDeFrota("oi bom dia tudo bem?", HOJE)).toBeNull();
  });

  it("data sem ano, já passada, vai para o ano seguinte", () => {
    const p = lerPerguntaDeFrota("a Saveiro está livre em 02/01?", new Date(2026, 11, 31));
    expect(p?.inicio).toBe("2027-01-02");
  });
});

describe("a resposta nasce da consulta, não do 'vou verificar'", () => {
  it("carro alocado: diz que não está disponível e oferece o outro", async () => {
    const urls: string[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      return new Response(
        JSON.stringify({
          data: {
            situacao: "alocado",
            alternativas: [{ modelo: "Onix", valor_diario: 180 }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const bloco = await blocoDaPerguntaDeFrota(
      adminCom(CONN) as never,
      "org-1",
      "a Saveiro está livre de 28/11 a 30/11?",
      HOJE,
      { fetchFn },
    );
    const chamada = new URL(urls[0]!);
    expect(chamada.pathname).toBe("/api/crm/disponibilidade");
    expect(chamada.searchParams.get("q")).toBe("Saveiro");
    expect(chamada.searchParams.get("inicio")).toBe("2026-11-28");
    expect(chamada.searchParams.get("fim")).toBe("2026-11-30");
    expect(bloco).toMatch(/Saveiro não está disponível/);
    expect(bloco).toMatch(/escolher outro/);
    expect(bloco).toMatch(/Onix/);
    expect(bloco).toMatch(/Não diga que vai verificar com a equipe/);
  });

  it("carro livre: diz que está disponível", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ data: { situacao: "disponivel", preco: 210 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const bloco = await blocoDaPerguntaDeFrota(
      adminCom(CONN) as never,
      "org-1",
      "Saveiro de 28/11 a 30/11",
      HOJE,
      { fetchFn },
    );
    expect(bloco).toMatch(/Saveiro está disponível/);
    expect(bloco).toMatch(/R\$ 210,00/);
    expect(bloco).not.toMatch(/pode dizer que vai verificar/);
  });

  it("mensal vazio não vira número", async () => {
    const fetchFn: typeof fetch = async (input) => {
      expect(new URL(String(input)).searchParams.get("q")).toBe("Saveiro");
      return new Response(
        JSON.stringify({ data: [{ modelo: "Saveiro", valor_diario: 150, valor_mensal: null }] }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const bloco = await blocoDaPerguntaDeFrota(
      adminCom(CONN) as never,
      "org-1",
      "quanto fica a Saveiro no mês?",
      HOJE,
      { fetchFn },
    );
    expect(bloco).toMatch(/não trouxe esse valor/);
    expect(bloco).toMatch(/não vira número/);
    expect(bloco).not.toMatch(/150/);
  });
});
