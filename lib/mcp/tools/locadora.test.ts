import { describe, expect, it, vi } from "vitest";

import { locadoraDaFicha } from "@/lib/mcp/tools/contacts";
import {
  moopeConsultarDisponibilidade,
  moopeGetRetrato,
  moopeListarOferta,
  moopeLookupLocatario,
} from "@/lib/mcp/tools/locadora";

vi.mock("@/lib/moope/cliente-locadora", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/moope/cliente-locadora")>();
  return {
    ...actual,
    lookupLocatario: vi.fn(),
    getRetratoLocatario: vi.fn(),
    consultarDisponibilidade: vi.fn(),
    listarOferta: vi.fn(),
  };
});

import {
  consultarDisponibilidade,
  getRetratoLocatario,
  listarOferta,
  lookupLocatario,
} from "@/lib/moope/cliente-locadora";

const ctx = {
  organizationId: "org-1",
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  },
};

describe("tools da locadora — o modelo lê código, não exception", () => {
  it("404 vira 'não é locatário', sem criar nada", async () => {
    vi.mocked(lookupLocatario).mockResolvedValue({ ok: false, codigo: "nao_encontrado" });
    const r = (await moopeLookupLocatario.handler({ phone: "+5511999998888" }, ctx as never)) as {
      encontrado: boolean;
      aviso: string;
    };
    expect(r.encontrado).toBe(false);
    expect(r.aviso).toMatch(/Não é locatário/);
  });

  it("5xx pede humano e não inventa boleto", async () => {
    vi.mocked(getRetratoLocatario).mockResolvedValue({ ok: false, codigo: "indisponivel" });
    const r = (await moopeGetRetrato.handler({ locatario_id: "loc-1" }, ctx as never)) as {
      aviso: string;
    };
    expect(r.aviso).toMatch(/indisponível/);
  });

  it("retrato com link devolve só o que a locadora trouxe", async () => {
    vi.mocked(getRetratoLocatario).mockResolvedValue({
      ok: true,
      locatario_id: "loc-1",
      nome: "João",
      telefone: "+5511",
      email: null,
      placa: "ABC1D23",
      contrato_titulo: "Onix",
      contrato_status: "ativo",
      faixa: "em_dia",
      amount_cents: 0,
      days_late: 0,
      portal_url: null,
      boleto_url: "https://asaas.exemplo/b/1",
      invoice_url: null,
      veiculo_modelo: "Onix",
      documentos: [],
      pode: ["boleto"],
    });
    const r = (await moopeGetRetrato.handler({ locatario_id: "loc-1" }, ctx as never)) as {
      tem_link: boolean;
      link_para_enviar: string;
    };
    expect(r.tem_link).toBe(true);
    expect(r.link_para_enviar).toBe("https://asaas.exemplo/b/1");
  });
});

describe("carro citado vai no parâmetro q", () => {
  it("as duas ferramentas oferecem q ao modelo", () => {
    expect(moopeListarOferta.inputSchema).toHaveProperty("q");
    expect(moopeConsultarDisponibilidade.inputSchema).toHaveProperty("q");
    expect(moopeListarOferta.description).toMatch(/\bq\b/);
    expect(moopeConsultarDisponibilidade.description).toMatch(/alternativas/);
  });

  it("disponibilidade devolve situacao e as alternativas da gestão", async () => {
    vi.mocked(consultarDisponibilidade).mockResolvedValue({
      ok: true,
      situacao: "indisponivel",
      carro: "Saveiro",
      categoria: null,
      unidade: null,
      inicio: "2026-11-28",
      fim: "2026-11-30",
      preco: null,
      alternativas: [{ modelo: "Onix", valor_diario: 180, valor_semanal: null, valor_mensal: null }],
    });
    const r = await moopeConsultarDisponibilidade.handler(
      { inicio: "2026-11-28", fim: "2026-11-30", q: "Saveiro" },
      ctx as never,
    );
    expect(consultarDisponibilidade).toHaveBeenCalledWith(
      ctx.supabase,
      "org-1",
      expect.objectContaining({ q: "Saveiro", inicio: "2026-11-28", fim: "2026-11-30" }),
    );
    expect(r).toMatchObject({
      situacao: "indisponivel",
      carro: "Saveiro",
      alternativas: [{ modelo: "Onix" }],
    });
  });

  it("oferta manda o carro e não inventa mensal ausente", async () => {
    vi.mocked(listarOferta).mockResolvedValue({
      ok: true,
      itens: [
        {
          modelo: "Saveiro",
          marca: null,
          ano: null,
          placa: null,
          valor_diario: 150,
          valor_semanal: null,
          valor_mensal: null,
          status: "DISPONIVEL",
          propulsao: null,
          eletrico: false,
          opcionais: null,
          foto_url: null,
        },
      ],
    });
    const r = (await moopeListarOferta.handler({ q: "Saveiro" }, ctx as never)) as {
      itens: { valor_mensal: number | null }[];
    };
    expect(listarOferta).toHaveBeenCalledWith(
      ctx.supabase,
      "org-1",
      {},
      expect.objectContaining({ q: "Saveiro" }),
    );
    expect(r.itens[0]?.valor_mensal).toBeNull();
  });
});

describe("locadoraDaFicha", () => {
  it("sem metadado, Conversador não vê número inventado", () => {
    expect(locadoraDaFicha({})).toBeNull();
    expect(locadoraDaFicha(null)).toBeNull();
  });

  it("com retrato, o link que já existe vai para a ficha", () => {
    const r = locadoraDaFicha({
      moope_external_id: "loc-1",
      retrato_locadora: { placa: "ABC1D23", boleto_url: "https://x/b" },
    });
    expect(r?.identificada).toBe(true);
    expect(r?.link_para_enviar).toBe("https://x/b");
    expect(r?.placa).toBe("ABC1D23");
  });
});
