import { describe, expect, it, vi } from "vitest";

import { aplicarBusinessPack } from "@/lib/business-packs/aplicar";
import { catalogoAmigavel } from "@/lib/business-packs/capacidades";
import { catalogoDePacks, packParaSubtypeLocacao, resolverPack } from "@/lib/business-packs/catalogo";
import {
  confirmacaoExtraParaDadoSensivel,
  ORDEM_DE_MATCH_IDENTIDADE,
} from "@/lib/business-packs/identidade";
import { classificarIntencao, intentEhOperacional } from "@/lib/business-packs/intents";
import { fundirArtifacts, lerPackGravado, montarBlocoPack } from "@/lib/business-packs/perfil";
import { CHAVE_PACK } from "@/lib/business-packs/tipos";
import { simularTestDrive } from "@/lib/business-packs/test-drive";
import { CHAVE_PERFIL } from "@/lib/ready-models/perfil";

function thenable(data: unknown) {
  const self = {
    eq: () => self,
    is: () => self,
    maybeSingle: async () => ({ data, error: null }),
    single: async () => ({ data, error: null }),
    select: () => self,
    then: (
      resolve: (v: { data: unknown; error: null }) => unknown,
      reject?: (e: unknown) => unknown,
    ) => Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return self;
}

function filtravel<T extends { id?: string; name?: string; title?: string }>(linhas: T[]) {
  const filtros: Record<string, unknown> = {};
  const self = {
    eq: (col: string, val: unknown) => {
      filtros[col] = val;
      return self;
    },
    is: () => self,
    maybeSingle: async () => {
      const achado = linhas.find((l) => {
        if (filtros.id && l.id !== filtros.id) return false;
        if (filtros.name && l.name !== filtros.name) return false;
        if (filtros.title && l.title !== filtros.title) return false;
        return true;
      });
      return { data: achado ?? null, error: null };
    },
    single: async () => ({ data: linhas[0] ?? null, error: null }),
    select: () => self,
  };
  return self;
}

function adminDePack(opts?: {
  settings?: Record<string, unknown>;
  agentes?: Array<{ id: string; name: string }>;
  templates?: Array<{ id: string; title: string }>;
  regras?: Array<{ id: string; name: string }>;
}) {
  const inserts: Array<{ tabela: string; row: Record<string, unknown> }> = [];
  const updates: Array<{ tabela: string; row: Record<string, unknown> }> = [];
  let settings = { ...(opts?.settings ?? {}) };
  const agentes = [...(opts?.agentes ?? [])];
  const templates = [...(opts?.templates ?? [])];
  const regras = [...(opts?.regras ?? [])];
  let seq = 1;

  return {
    inserts,
    updates,
    get settings() {
      return settings;
    },
    rpc: vi.fn(async (fn: string) => {
      if (fn === "fn_aplicar_quadro_do_onboarding") return { data: { ok: true }, error: null };
      return { data: null, error: null };
    }),
    from: (tabela: string) => ({
      select: (cols?: string) => {
        if (tabela === "organizations") return thenable({ settings });
        if (tabela === "crm_pipelines") {
          if (cols === "slug") return thenable([{ slug: "pedidos" }]);
          if (cols === "id") return thenable({ id: "pipe-1" });
          return thenable({ id: "pipe-1", settings: {}, vocabulary: {}, slug: "pedidos" });
        }
        if (tabela === "crm_stages") return thenable([]);
        if (tabela === "ai_agents") return filtravel(agentes);
        if (tabela === "message_templates") return filtravel(templates);
        if (tabela === "automation_rules") return filtravel(regras);
        return thenable(null);
      },
      update: (row: Record<string, unknown>) => {
        updates.push({ tabela, row });
        if (tabela === "organizations" && row.settings && typeof row.settings === "object") {
          settings = { ...settings, ...(row.settings as Record<string, unknown>) };
        }
        return thenable(null);
      },
      insert: (row: Record<string, unknown>) => {
        inserts.push({ tabela, row });
        const id = `${tabela}-${seq++}`;
        if (tabela === "ai_agents") agentes.push({ id, name: String(row.name ?? "") });
        if (tabela === "message_templates") templates.push({ id, title: String(row.title ?? "") });
        if (tabela === "automation_rules") regras.push({ id, name: String(row.name ?? "") });
        return Object.assign(thenable({ id }), { select: () => thenable({ id }) });
      },
    }),
  };
}

const pack = resolverPack("locadora_veiculos")!;

describe("catálogo do pack", () => {
  it("locadora_veiculos@1.0 existe e aponta para locacao/veiculos", () => {
    expect(pack.id).toBe("locadora_veiculos");
    expect(pack.version).toBe("1.0");
    expect(pack.ready_model_id).toBe("locacao");
    expect(pack.ready_model_subtype).toBe("veiculos");
    expect(packParaSubtypeLocacao("veiculos")).toBe("locadora_veiculos");
    expect(packParaSubtypeLocacao("imoveis")).toBeNull();
    expect(catalogoDePacks()[0]?.id).toBe("locadora_veiculos");
  });

  it("funil tem 8 etapas com ganho e perda", () => {
    expect(pack.pipeline.etapas).toHaveLength(8);
    expect(pack.pipeline.etapas.some((e) => e.passo === "won")).toBe(true);
    expect(pack.pipeline.etapas.some((e) => e.passo === "lost")).toBe(true);
    expect(pack.pipeline.nome).toBe("COMERCIAL — LOCADORA");
  });

  it("não inventa preço, caução nem política", () => {
    const texto = JSON.stringify(pack);
    expect(texto).not.toMatch(/R\$\s*\d/);
    expect(texto.toLowerCase()).not.toContain("diária padrão");
    expect(texto.toLowerCase()).not.toContain("caução padrão");
  });

  it("seis especialidades e recepção é a cara da conversa", () => {
    expect(pack.specialties).toHaveLength(6);
    expect(pack.specialties.filter((s) => s.is_default)).toHaveLength(1);
    expect(pack.specialties.find((s) => s.is_default)?.key).toBe("recepcao");
  });
});

describe("versionamento e customização", () => {
  it("ler/gravar pack no JSONB", () => {
    const bloco = montarBlocoPack("locadora_veiculos", "1.0", {
      agent_keys: { recepcao: "a1" },
      collection_slugs: { geral: "c1" },
      template_keys: {},
      automation_keys: {},
      campaign_keys: {},
      followup_keys: {},
    });
    const lido = lerPackGravado({ [CHAVE_PACK]: bloco });
    expect(lido?.id).toBe("locadora_veiculos");
    expect(lido?.artifacts.agent_keys.recepcao).toBe("a1");
  });

  it("fundir artifacts nunca apaga id já gravado", () => {
    const atual = {
      agent_keys: { recepcao: "cliente-renomeou" },
      collection_slugs: {},
      template_keys: {},
      automation_keys: {},
      campaign_keys: {},
      followup_keys: {},
    };
    const extra = {
      agent_keys: { recepcao: "novo", comercial: "c2" },
      collection_slugs: { geral: "g1" },
      template_keys: {},
      automation_keys: {},
      campaign_keys: {},
      followup_keys: {},
    };
    const f = fundirArtifacts(atual, extra);
    expect(f.agent_keys.recepcao).toBe("cliente-renomeou");
    expect(f.agent_keys.comercial).toBe("c2");
  });
});

describe("intent routing do pack", () => {
  it("mapeia intenções para especialidades", () => {
    expect(classificarIntencao("Quero alugar um carro de amanhã até sexta.", pack.intents).specialty_key).toBe(
      "comercial",
    );
    expect(classificarIntencao("Tem SUV disponível?", pack.intents).intent).toBe("disponibilidade");
    expect(classificarIntencao("Preciso da segunda via do meu boleto.", pack.intents).specialty_key).toBe(
      "financeiro",
    );
    expect(classificarIntencao("Bati o carro. O que faço?", pack.intents).specialty_key).toBe("atendimento");
    expect(classificarIntencao("Quero prorrogar minha locação.", pack.intents).intent).toBe("prorrogacao");
    expect(classificarIntencao("asdf qwerty", pack.intents).incerto).toBe(true);
  });

  it("boleto e disponibilidade são operacionais", () => {
    expect(intentEhOperacional("boleto")).toBe(true);
    expect(intentEhOperacional("disponibilidade")).toBe(true);
    expect(intentEhOperacional("saudacao")).toBe(false);
  });
});

describe("standalone sem Gestão", () => {
  it("boleto não inventa valor", () => {
    const r = simularTestDrive({
      mensagem: "Preciso da segunda via do meu boleto.",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Locadora ABC",
    });
    expect(r.resposta.toLowerCase()).toContain("não consegui consultar");
    expect(r.resposta).not.toMatch(/\d+,\d{2}/);
    expect(r.gestao_necessaria).toBe(true);
  });

  it("disponibilidade não afirma frota", () => {
    const r = simularTestDrive({
      mensagem: "Tem SUV disponível?",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Locadora ABC",
    });
    expect(r.resposta.toLowerCase()).not.toContain("está disponível");
    expect(r.gestao_necessaria).toBe(true);
  });
});

describe("tool catalog amigável", () => {
  it("checks refletem tools reais e ausência de gestão", () => {
    const sem = catalogoAmigavel(pack.capabilities, false);
    expect(sem.find((c) => c.key === "clientes")?.disponivel).toBe(false);
    expect(sem.find((c) => c.key === "multas")?.disponivel).toBe(false);
    const com = catalogoAmigavel(pack.capabilities, true);
    expect(com.find((c) => c.key === "clientes")?.disponivel).toBe(true);
    expect(com.find((c) => c.key === "financeiro")?.tool_id).toBe("moope_get_retrato");
    expect(com.find((c) => c.key === "sinistros")?.disponivel).toBe(false);
  });
});

describe("identidade", () => {
  it("nome não entra na ordem de match", () => {
    expect(ORDEM_DE_MATCH_IDENTIDADE).not.toContain("nome");
    expect(ORDEM_DE_MATCH_IDENTIDADE[0]).toBe("vinculo_persistido");
    expect(confirmacaoExtraParaDadoSensivel("cpf_cnpj_autorizado")).toBe(true);
  });
});

describe("instalador", () => {
  it("instala e grava versionamento", async () => {
    const db = adminDePack();
    const r = await aplicarBusinessPack(db as never, "org-a", "locadora_veiculos", {
      actorUserId: "user-1",
    });
    expect(r.ok).toBe(true);
    expect(r.noop).toBe(false);
    const gravado = lerPackGravado(db.settings);
    expect(gravado?.id).toBe("locadora_veiculos");
    expect(gravado?.version).toBe("1.0");
    expect(db.settings.ai_mode).toBe("copilot");
    expect(db.settings.ai_mode).not.toBe("autonomous");
    expect((db.settings[CHAVE_PERFIL] as { id?: string } | undefined)?.id).toBe("locacao");
  });

  it("reaplicar o mesmo pack não duplica agentes nem templates", async () => {
    const db = adminDePack();
    await aplicarBusinessPack(db as never, "org-a", "locadora_veiculos");
    const agentes1 = db.inserts.filter((i) => i.tabela === "ai_agents").length;
    const tpls1 = db.inserts.filter((i) => i.tabela === "message_templates").length;
    await aplicarBusinessPack(db as never, "org-a", "locadora_veiculos");
    const agentes2 = db.inserts.filter((i) => i.tabela === "ai_agents").length;
    const tpls2 = db.inserts.filter((i) => i.tabela === "message_templates").length;
    expect(agentes2).toBe(agentes1);
    expect(tpls2).toBe(tpls1);
  });

  it("não sobrescreve agente que o cliente já tinha com o mesmo nome", async () => {
    const db = adminDePack({
      agentes: [{ id: "existente", name: "Consultor Comercial" }],
    });
    await aplicarBusinessPack(db as never, "org-a", "locadora_veiculos");
    const criados = db.inserts.filter(
      (i) => i.tabela === "ai_agents" && i.row.name === "Consultor Comercial",
    );
    expect(criados).toHaveLength(0);
    const gravado = lerPackGravado(db.settings);
    expect(gravado?.artifacts.agent_keys.comercial).toBe("existente");
  });

  it("automações nascem desligadas", async () => {
    const db = adminDePack();
    await aplicarBusinessPack(db as never, "org-a", "locadora_veiculos");
    const regras = db.inserts.filter(
      (i) => i.tabela === "automation_rules" && !String(i.row.name).startsWith("rm:"),
    );
    expect(regras.length).toBeGreaterThan(0);
    expect(regras.every((r) => r.row.is_active === false)).toBe(true);
  });

  it("não grava automação de boleto sem tool de gestão", async () => {
    const db = adminDePack();
    await aplicarBusinessPack(db as never, "org-a", "locadora_veiculos");
    const nomes = db.inserts
      .filter((i) => i.tabela === "automation_rules")
      .map((i) => String(i.row.name));
    expect(nomes.join(" ")).not.toMatch(/Boleto a vencer/i);
  });

  it("inbound não é sobrescrito se já existe", async () => {
    const inbound = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const db = adminDePack({
      settings: { crm: { inbound_pipeline_id: inbound } },
    });
    await aplicarBusinessPack(db as never, "org-a", "locadora_veiculos");
    const crm = db.settings.crm as { inbound_pipeline_id?: string };
    expect(crm.inbound_pipeline_id).toBe(inbound);
  });

  it("ai_mode existente não vira autonomous nem é sobrescrito", async () => {
    const db = adminDePack({ settings: { ai_mode: "controlled" } });
    await aplicarBusinessPack(db as never, "org-a", "locadora_veiculos");
    expect(db.settings.ai_mode).toBe("controlled");
  });

  it("tenant B começa sem o pack de A", () => {
    const settingsB = {};
    expect(lerPackGravado(settingsB)).toBeNull();
  });
});
