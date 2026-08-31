import { describe, expect, it, vi } from "vitest";

import {
  CHAVE_PERFIL,
  garantirQuadroComoPadrao,
  inferirPerfilPeloNomeDoQuadro,
  lerPerfilGravado,
  pacoteDoPerfil,
  quadroJaServeOPacote,
} from "@/lib/onboarding/aplicar-perfil";
import { PACOTES } from "@/lib/onboarding/pacotes-de-funil";

describe("perfil do negócio", () => {
  it("a venda do sistema é um perfil — não se mistura com operar a frota", () => {
    expect(pacoteDoPerfil("saas")?.proposta.nome).toBe("Vendas SaaS");
    expect(pacoteDoPerfil("locadora")?.proposta.nome).toBe("Locatários");
    expect(PACOTES.some((p) => p.id === "saas")).toBe(true);
  });

  it("lê o perfil gravado em settings — lixo não vira escolha", () => {
    expect(lerPerfilGravado(null)).toBeNull();
    expect(lerPerfilGravado({ [CHAVE_PERFIL]: { id: "locadora" } })).toBe("locadora");
    expect(lerPerfilGravado({ [CHAVE_PERFIL]: { id: "nao-existe" } })).toBeNull();
  });

  it("infere o perfil pelo nome do quadro padrão — Locatários ≠ Vendas SaaS", () => {
    expect(inferirPerfilPeloNomeDoQuadro("Vendas SaaS")).toBe("saas");
    expect(inferirPerfilPeloNomeDoQuadro("Locatários")).toBe("locadora");
    expect(inferirPerfilPeloNomeDoQuadro("Pedidos")).toBeNull();
  });

  it("o quadro só 'já serve' quando tem o ganho e a perda do pacote", () => {
    const loc = pacoteDoPerfil("locadora")!.proposta;
    expect(quadroJaServeOPacote(["Contrato ativo", "Não fechou"], loc)).toBe(true);
    expect(quadroJaServeOPacote(["Pago", "Cancelado"], loc)).toBe(false);
  });
});

function adminQueRecusaQuadroComNegocio() {
  const inserts: unknown[] = [];
  const updates: unknown[] = [];
  let leituraDePadrao = 0;
  const thenable = (data: unknown) =>
    Object.assign(Promise.resolve({ data, error: null }), {
      eq: () => thenable(data),
      maybeSingle: async () => ({ data, error: null }),
      single: async () => ({ data, error: null }),
    });
  return {
    inserts,
    updates,
    rpc: vi.fn(async () => ({
      data: { ok: false, motivo: "funil_com_negocios", quantos: 3 },
      error: null,
    })),
    from: (tabela: string) => ({
      select: () => {
        if (tabela === "crm_stages") return thenable([]);
        if (tabela === "organizations") return thenable({ settings: {} });
        leituraDePadrao += 1;
        // 1 = funil padrão; 2 = slugs; 3 = por nome (não achar → cria)
        if (leituraDePadrao === 1) return thenable({ id: "padrao-velho" });
        return thenable(leituraDePadrao === 3 ? null : []);
      },
      update: (row: unknown) => {
        updates.push(row);
        return thenable(null);
      },
      insert: (row: unknown) => {
        inserts.push(row);
        const criado = { id: "quadro-novo" };
        return Object.assign(thenable(criado), {
          select: () => thenable(criado),
        });
      },
    }),
  };
}

describe("trocar perfil com funil já em uso", () => {
  it("nasce um quadro novo e ele vira o padrão — o velho fica", async () => {
    const db = adminQueRecusaQuadroComNegocio();
    const r = await garantirQuadroComoPadrao(
      db as never,
      "org-1",
      pacoteDoPerfil("saas")!.proposta,
    );
    expect(r.criou).toBe(true);
    expect(r.id).toBe("quadro-novo");
    expect(db.rpc).toHaveBeenCalledOnce();
    expect(db.updates.some((u) => (u as { is_default?: boolean }).is_default === false)).toBe(
      true,
    );
    const funil = db.inserts.find((i) => !Array.isArray(i)) as { name?: string; is_default?: boolean };
    expect(funil?.name).toBe("Vendas SaaS");
    expect(funil?.is_default).toBe(true);
    expect(Array.isArray(db.inserts.find((i) => Array.isArray(i)))).toBe(true);
  });
});
