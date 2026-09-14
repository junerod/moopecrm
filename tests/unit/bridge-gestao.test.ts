import { describe, expect, it, vi } from "vitest";

import { resolverCriterioDeIdentidade } from "@/lib/business-packs/identidade";
import {
  consultarDisponibilidade,
  consultarFinanceiro,
  consultarLocacao,
  consultarMultas,
  listarUnidades,
  lookupLocatario,
  obterSegundaVia,
} from "@/lib/moope/cliente-locadora";
import { fetchMockGestao, MOCK_GESTAO_SECRET, MOCK_LOCATARIO_ID } from "@/lib/moope/mock-gestao";

vi.mock("@/lib/webhooks/secrets", () => ({
  decryptWebhookSecret: vi.fn(async () => MOCK_GESTAO_SECRET),
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
  partner_webhook_url: "https://gestao.exemplo/api/crm/events/9",
  partner_api_url: "https://gestao.exemplo",
  inbound_key_prefix: "mop_aa",
  inbound_key_hash: "hh",
  outbound_secret_enc: "\\x00",
  status: "active",
};

describe("identidade do Bridge", () => {
  it("nome sozinho falha fechado", () => {
    expect(resolverCriterioDeIdentidade({ nome: "Maria" })).toEqual({
      ok: false,
      motivo: "nome_sozinho",
    });
  });

  it("segue a ordem segura", () => {
    expect(resolverCriterioDeIdentidade({ external_id: "ext-1", nome: "Maria" }).ok).toBe(true);
    expect(resolverCriterioDeIdentidade({ telefone: "+5511999887766" })).toMatchObject({
      criterio: "telefone_normalizado",
    });
  });
});

describe("contrato mock da Gestão", () => {
  it("HMAC inválido = 401", async () => {
    const r = await lookupLocatario(
      adminCom(CONN) as never,
      "org-1",
      { phone: "+5511999887766" },
      {
        fetchFn: (input, init) =>
          fetchMockGestao(input, { ...init, headers: { "X-Moope-Signature": "sha256=errado" } }),
      },
    );
    expect(r).toMatchObject({ ok: false, codigo: "nao_autorizado" });
  });

  it("identifica por external_id e lê locação/financeiro/segunda via", async () => {
    const deps = { fetchFn: fetchMockGestao };
    const lookup = await lookupLocatario(adminCom(CONN) as never, "org-1", { external_id: MOCK_LOCATARIO_ID }, deps);
    expect(lookup).toMatchObject({ ok: true, locatario_id: MOCK_LOCATARIO_ID });

    const loc = await consultarLocacao(adminCom(CONN) as never, "org-1", MOCK_LOCATARIO_ID, deps);
    expect(loc.ok).toBe(true);
    if (loc.ok) expect(loc.itens[0]?.veiculo).toBe("Onix");

    const fin = await consultarFinanceiro(adminCom(CONN) as never, "org-1", MOCK_LOCATARIO_ID, deps);
    expect(fin.ok).toBe(true);
    if (fin.ok) {
      expect(fin.parcelas).toHaveLength(1);
      expect(fin.boleto_url).toContain("boleto");
      expect(fin.pix_url).toContain("pix");
    }

    const via = await obterSegundaVia(adminCom(CONN) as never, "org-1", MOCK_LOCATARIO_ID, deps);
    expect(via.ok).toBe(true);
    if (via.ok) expect(via.boleto_url).toBeTruthy();
  });

  it("disponibilidade exige período e não inventa frota", async () => {
    const semPeriodo = await consultarDisponibilidade(adminCom(CONN) as never, "org-1", {}, { fetchFn: fetchMockGestao });
    expect(semPeriodo).toEqual({ ok: false, codigo: "entrada_invalida" });

    const com = await consultarDisponibilidade(
      adminCom(CONN) as never,
      "org-1",
      { inicio: "2026-09-20", fim: "2026-09-25", categoria: "suv" },
      { fetchFn: fetchMockGestao },
    );
    expect(com.ok).toBe(true);
    if (com.ok) expect(com.situacao).toBe("disponivel");
  });

  it("409 ambíguo e 404 sem dado", async () => {
    const amb = await lookupLocatario(adminCom(CONN) as never, "org-1", { phone: "+5511999991111" }, { fetchFn: fetchMockGestao });
    expect(amb).toMatchObject({ ok: false, codigo: "ambiguo" });
    const no = await lookupLocatario(adminCom(CONN) as never, "org-1", { phone: "+5511999990000" }, { fetchFn: fetchMockGestao });
    expect(no).toMatchObject({ ok: false, codigo: "nao_encontrado" });
  });

  it("timeout vira indisponivel — não inventa negativo", async () => {
    const r = await consultarMultas(adminCom(CONN) as never, "org-1", MOCK_LOCATARIO_ID, {
      timeoutMs: 1,
      fetchFn: async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        throw new DOMException("aborted", "AbortError");
      },
    });
    expect(r).toMatchObject({ ok: false, codigo: "indisponivel" });
  });

  it("unidades só as que a gestão devolve", async () => {
    const r = await listarUnidades(adminCom(CONN) as never, "org-1", { fetchFn: fetchMockGestao });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.itens[0]?.nome).toBe("Unidade Centro");
  });

  it("sem integração não inventa cliente", async () => {
    const r = await lookupLocatario(adminCom(null) as never, "org-1", { phone: "+5511999887766" });
    expect(r).toEqual({ ok: false, codigo: "sem_integracao" });
  });
});
