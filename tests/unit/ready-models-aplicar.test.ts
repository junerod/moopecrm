import { describe, expect, it, vi } from "vitest";

import { aplicarReadyModel } from "@/lib/ready-models/aplicar";
import { resolverDefinition } from "@/lib/ready-models/catalogo";
import { CHAVE_PERFIL } from "@/lib/ready-models/perfil";

type Linha = Record<string, unknown>;

function adminDeTeste(opts?: {
  perfil?: unknown;
  rpcMotivo?: string;
  regras?: Array<{ id: string; name: string }>;
  pointers?: Array<{ id: string; name: string }>;
  templates?: Array<{ id: string; title: string }>;
  leadsNoPadrao?: boolean;
}) {
  const inserts: Array<{ tabela: string; row: unknown }> = [];
  const updates: Array<{ tabela: string; row: unknown }> = [];
  let leituraPadrao = 0;
  const perfilAtual = opts?.perfil ?? {};
  const thenable = (data: unknown) =>
    Object.assign(Promise.resolve({ data, error: null }), {
      eq: () => thenable(data),
      maybeSingle: async () => ({ data, error: null }),
      single: async () => ({ data, error: null }),
    });

  return {
    inserts,
    updates,
    rpc: vi.fn(async (fn: string) => {
      if (fn === "fn_aplicar_quadro_do_onboarding") {
        if (opts?.rpcMotivo === "funil_com_negocios") {
          return { data: { ok: false, motivo: "funil_com_negocios", quantos: 2 }, error: null };
        }
        return { data: { ok: true }, error: null };
      }
      if (fn === "fn_publish_followup_flow_version") {
        return { data: "version-1", error: null };
      }
      return { data: null, error: null };
    }),
    from: (tabela: string) => ({
      select: (cols?: string) => {
        void cols;
        if (tabela === "organizations") {
          return thenable({ settings: perfilAtual });
        }
        if (tabela === "crm_stages") return thenable([]);
        if (tabela === "automation_rules") {
          const nome = opts?.regras?.[0];
          return thenable(nome ?? null);
        }
        if (tabela === "followup_flow_pointers") {
          return thenable(opts?.pointers?.[0] ?? null);
        }
        if (tabela === "message_templates") {
          return thenable(opts?.templates?.[0] ?? null);
        }
        if (tabela === "crm_pipelines") {
          leituraPadrao += 1;
          // 1 = funil padrão; 2 = slugs (lista); depois settings ou porNome
          if (leituraPadrao === 1) return thenable({ id: "padrao-velho" });
          if (leituraPadrao === 2) return thenable([{ slug: "pedidos" }]);
          if (opts?.rpcMotivo === "funil_com_negocios" && leituraPadrao === 3) {
            return thenable(null);
          }
          return thenable({
            id: "padrao-velho",
            settings: {},
            vocabulary: {},
            slug: "pedidos",
          });
        }
        return thenable(null);
      },
      update: (row: unknown) => {
        updates.push({ tabela, row });
        return thenable(null);
      },
      insert: (row: unknown) => {
        inserts.push({ tabela, row });
        const id =
          tabela === "crm_pipelines"
            ? "quadro-novo"
            : tabela === "automation_rules"
              ? "rule-1"
              : tabela === "followup_flow_pointers"
                ? "ptr-1"
                : tabela === "message_templates"
                  ? "tpl-1"
                  : "novo";
        return Object.assign(thenable({ id }), {
          select: () => thenable({ id }),
        });
      },
    }),
  };
}

describe("instalador genérico de Ready Model", () => {
  it("A. locacao@1.0 instala e grava id/version", async () => {
    const db = adminDeTeste();
    const r = await aplicarReadyModel(db as never, "org-1", resolverDefinition("locacao")!, {
      followup: false,
    });
    expect(r.ok).toBe(true);
    expect(r.noop).toBe(false);
    if (r.ok && !r.noop) {
      expect(r.perfil.id).toBe("locacao");
      expect(r.perfil.version).toBe("1.0");
    }
    const perfil = db.updates.find((u) => u.tabela === "organizations")?.row as {
      settings?: { perfil_do_negocio?: { id?: string; version?: string } };
    };
    expect(perfil?.settings?.[CHAVE_PERFIL]?.id).toBe("locacao");
    expect(perfil?.settings?.[CHAVE_PERFIL]?.version).toBe("1.0");
  });

  it("B. locacao + maquinas_e_equipamentos grava subtype", async () => {
    const db = adminDeTeste();
    const r = await aplicarReadyModel(
      db as never,
      "org-1",
      resolverDefinition("locacao", "maquinas_e_equipamentos")!,
      { followup: false },
    );
    expect(r.ok && !r.noop && r.perfil.subtype).toBe("maquinas_e_equipamentos");
    const settingsQuadro = db.updates.find((u) => u.tabela === "crm_pipelines")?.row as {
      settings?: { fields?: Array<{ key: string; label: string }> };
    };
    expect(settingsQuadro?.settings?.fields?.find((f) => f.key === "item_tipo")?.label).toBe(
      "Equipamento",
    );
  });

  it("C. mesma version duas vezes não duplica artifacts", async () => {
    const ja = {
      [CHAVE_PERFIL]: { id: "locacao", version: "1.0", aplicado_em: "2026-01-01T00:00:00.000Z" },
    };
    const db = adminDeTeste({ perfil: ja, regras: [{ id: "rule-1", name: "rm:locacao:tag-novo" }] });
    const r = await aplicarReadyModel(db as never, "org-1", resolverDefinition("locacao")!, {
      followup: false,
      noopSeJaAplicado: true,
    });
    expect(r.ok && r.noop).toBe(true);
    expect(db.inserts.filter((i) => i.tabela === "crm_pipelines")).toHaveLength(0);
    expect(db.inserts.filter((i) => i.tabela === "automation_rules")).toHaveLength(0);
    expect(db.inserts.filter((i) => i.tabela === "followup_flow_pointers")).toHaveLength(0);
  });

  it("D. advocacia@1.0 não chama código de locação", async () => {
    const db = adminDeTeste();
    const r = await aplicarReadyModel(db as never, "org-1", resolverDefinition("advocacia")!, {
      followup: false,
    });
    expect(r.ok && !r.noop && r.perfil.id).toBe("advocacia");
    const texto = JSON.stringify(db.inserts) + JSON.stringify(db.updates);
    expect(texto).not.toMatch(/TOOLS_LOCADORA|Cobrança|locadora/i);
    expect(texto).not.toMatch(/rm:locacao/);
  });

  it("E/F/G. comercial, servicos e personalizado instalam", async () => {
    for (const id of ["comercial", "servicos", "personalizado"] as const) {
      const db = adminDeTeste();
      const r = await aplicarReadyModel(db as never, "org-1", resolverDefinition(id)!, {
        followup: false,
      });
      expect(r.ok && !r.noop && r.perfil.id).toBe(id);
    }
  });

  it("H/I. funil com negócios nasce quadro novo — sem apagar o velho", async () => {
    const db = adminDeTeste({ rpcMotivo: "funil_com_negocios" });
    const r = await aplicarReadyModel(db as never, "org-1", resolverDefinition("comercial")!, {
      followup: false,
    });
    expect(r.ok && !r.noop && r.criouQuadroNovo).toBe(true);
    expect(r.ok && r.pipelinePadraoId).toBe("quadro-novo");
    expect(db.inserts.some((i) => i.tabela === "crm_pipelines")).toBe(true);
    expect(db.updates.some((u) => (u.row as Linha).is_default === false)).toBe(true);
  });

  it("J. perfil registra id/version/subtype", async () => {
    const db = adminDeTeste();
    await aplicarReadyModel(
      db as never,
      "org-1",
      resolverDefinition("locacao", "ferramentas")!,
      { followup: false },
    );
    const perfil = db.updates.find((u) => u.tabela === "organizations")?.row as {
      settings?: { perfil_do_negocio?: { id: string; version: string; subtype?: string } };
    };
    expect(perfil.settings?.perfil_do_negocio).toMatchObject({
      id: "locacao",
      version: "1.0",
      subtype: "ferramentas",
    });
  });

  it("follow-up OFF não cria pointer; ON cria um e a 2ª vez reusa", async () => {
    const dbOff = adminDeTeste();
    await aplicarReadyModel(dbOff as never, "org-1", resolverDefinition("locacao")!, {
      followup: false,
    });
    expect(dbOff.inserts.filter((i) => i.tabela === "followup_flow_pointers")).toHaveLength(0);

    const dbOn = adminDeTeste();
    const r1 = await aplicarReadyModel(dbOn as never, "org-1", resolverDefinition("locacao")!, {
      followup: true,
      actorUserId: "user-1",
    });
    expect(r1.ok && !r1.noop && r1.artifacts.followup_pointer_id).toBe("ptr-1");

    const db2 = adminDeTeste({
      perfil: {
        [CHAVE_PERFIL]: { id: "locacao", version: "1.0", aplicado_em: "2026-01-01T00:00:00.000Z" },
      },
      pointers: [{ id: "ptr-1", name: "rm:locacao:silencio-24h" }],
    });
    const r2 = await aplicarReadyModel(db2 as never, "org-1", resolverDefinition("locacao")!, {
      followup: true,
      actorUserId: "user-1",
    });
    expect(r2.ok && r2.noop).toBe(true);
    expect(db2.inserts.filter((i) => i.tabela === "followup_flow_pointers")).toHaveLength(0);
  });
});
