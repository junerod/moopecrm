import { describe, expect, it } from "vitest";

import { aplicarBusinessPack } from "@/lib/business-packs/aplicar";
import { montarLojaDePacks, testidAtivarModelo } from "@/lib/business-packs/apresentacao";
import { catalogoDePacks, packParaRamo, resolverPack } from "@/lib/business-packs/catalogo";
import { classificarIntencao, intentEhSensivel } from "@/lib/business-packs/intents";
import { fundirArtifacts } from "@/lib/business-packs/perfil";
import { simularTestDrive } from "@/lib/business-packs/test-drive";

const pack = resolverPack("escritorio_advocacia")!;

describe("catálogo do pack advocacia", () => {
  it("escritorio_advocacia@1.0 existe no mesmo motor", () => {
    expect(pack.id).toBe("escritorio_advocacia");
    expect(pack.version).toBe("1.0");
    expect(pack.ready_model_id).toBe("advocacia");
    expect(packParaRamo("advocacia")).toBe("escritorio_advocacia");
    expect(catalogoDePacks().some((p) => p.id === "escritorio_advocacia")).toBe(true);
  });

  it("loja de modelos prontos lista os dois packs com botão de ativar", () => {
    const loja = montarLojaDePacks();
    expect(loja.map((p) => p.id)).toEqual([
      "locadora_veiculos",
      "escritorio_advocacia",
      "vendas_saas",
      "comercial_geral",
      "clinica_medica",
      "clinica_odontologica",
    ]);
    expect(loja[0]?.funilNome).toBe("COMERCIAL — LOCADORA");
    expect(loja[1]?.funilNome).toBe("COMERCIAL — ESCRITÓRIO");
    expect(testidAtivarModelo("locadora_veiculos")).toBe("usar-modelo-locadora");
    expect(testidAtivarModelo("escritorio_advocacia")).toBe("usar-modelo-escritorio_advocacia");
  });

  it("funil comercial do escritório tem 8 etapas", () => {
    expect(pack.pipeline.nome).toBe("COMERCIAL — ESCRITÓRIO");
    expect(pack.pipeline.etapas).toHaveLength(8);
    expect(pack.pipeline.etapas.map((e) => e.nome)).toEqual([
      "Novo contato",
      "Triagem",
      "Qualificado",
      "Consulta agendada",
      "Proposta enviada",
      "Em negociação",
      "Contratado",
      "Não contratado",
    ]);
  });

  it("seis especialidades e recepção é a cara da conversa", () => {
    expect(pack.specialties).toHaveLength(6);
    expect(pack.specialties.filter((s) => s.is_default)).toHaveLength(1);
    expect(pack.specialties.find((s) => s.is_default)?.key).toBe("recepcao");
    expect(pack.specialties.map((s) => s.key).sort()).toEqual([
      "atendimento",
      "comercial",
      "documentos",
      "financeiro",
      "recepcao",
      "relacionamento",
    ]);
  });

  it("não inventa honorário, prazo, andamento nem legislação", () => {
    const texto = JSON.stringify(pack);
    expect(texto).not.toMatch(/R\$\s*\d/);
    expect(texto.toLowerCase()).not.toContain("honorário padrão");
    expect(texto.toLowerCase()).not.toContain("prazo legal");
    expect(texto.toLowerCase()).not.toContain("art. ");
    expect(texto.toLowerCase()).not.toContain("jurisprudência consolidada");
  });

  it("automações nascem desligadas e sem aconselhamento jurídico", () => {
    expect(pack.automations).toHaveLength(8);
    expect(pack.automations.every((a) => !a.requires_gestao)).toBe(true);
    expect(pack.ai_mode_default).toBe("copilot");
    expect(pack.ai_mode_default).not.toBe("autonomous");
  });

  it("coleções começam vazias — sem legislação genérica", () => {
    expect(pack.collections).toHaveLength(5);
    expect(pack.collections.map((c) => c.name)).toEqual([
      "Atendimento do Escritório",
      "Áreas de Atuação",
      "Documentos e Procedimentos",
      "Comercial e Honorários",
      "Relacionamento",
    ]);
  });
});

describe("test-drive jurídico", () => {
  it("andamento e decisão vão para humano sem inventar", () => {
    for (const msg of ["Como está meu processo?", "Qual foi a decisão do juiz?"]) {
      const r = simularTestDrive({
        mensagem: msg,
        definition: pack,
        gestaoConfigurada: false,
        orgName: "Silva Advogados",
      });
      expect(r.precisa_humano).toBe(true);
      expect(r.resposta.toLowerCase()).not.toContain("deferido");
      expect(r.resposta.toLowerCase()).not.toContain("prazo de 15");
      expect(intentEhSensivel(r.intent)).toBe(true);
    }
  });

  it("honorário sem fonte não inventa valor", () => {
    const r = simularTestDrive({
      mensagem: "Quanto custa?",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Silva Advogados",
    });
    expect(r.intent).toBe("honorario");
    expect(r.precisa_humano).toBe(true);
    expect(r.resposta).not.toMatch(/\d+,\d{2}/);
    expect(r.resposta.toLowerCase()).toMatch(/não invento honorário|não invent/);
  });

  it("documentos sem knowledge não inventa lista específica", () => {
    const r = simularTestDrive({
      mensagem: "Quais documentos preciso levar?",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Silva Advogados",
    });
    expect(r.intent).toBe("documentos");
    expect(r.resposta.toLowerCase()).not.toContain("certidão de nascimento");
    expect(r.resposta.toLowerCase()).toMatch(/não invent|checklist/);
  });

  it("consulta e triagem funcionam sem WhatsApp", () => {
    const consulta = simularTestDrive({
      mensagem: "Quero marcar uma consulta.",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Silva Advogados",
    });
    expect(consulta.specialty_key).toBe("comercial");
    expect(consulta.resposta.toLowerCase()).toMatch(/agendar|horário/);

    const triagem = simularTestDrive({
      mensagem: "Quero falar com um advogado sobre meu caso.",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Silva Advogados",
    });
    expect(triagem.specialty_key).toBe("recepcao");
    expect(classificarIntencao(triagem.intent === "falar_advogado" ? "falar com advogado" : "x", pack.intents).specialty_key).toBe("recepcao");
  });

  it("knowledge hit é citado, não inventado", () => {
    const r = simularTestDrive({
      mensagem: "Quais documentos preciso levar?",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Silva Advogados",
      knowledgeHits: [{ texto: "Leve RG e comprovante de residência.", fonte: "Documentos e Procedimentos" }],
    });
    expect(r.resposta).toContain("RG e comprovante");
    expect(r.knowledge_hint).toBe("Documentos e Procedimentos");
  });
});

describe("idempotência do pack advocacia", () => {
  it("fundir artifacts preserva id já gravado", () => {
    const f = fundirArtifacts(
      {
        agent_keys: { recepcao: "editado" },
        collection_slugs: {},
        template_keys: {},
        automation_keys: {},
        campaign_keys: {},
        followup_keys: {},
      },
      {
        agent_keys: { recepcao: "novo", comercial: "c2" },
        collection_slugs: {},
        template_keys: {},
        automation_keys: {},
        campaign_keys: {},
        followup_keys: {},
      },
    );
    expect(f.agent_keys.recepcao).toBe("editado");
    expect(f.agent_keys.comercial).toBe("c2");
  });

  it("instalador não é if (advocacia) — usa o mesmo aplicarBusinessPack", async () => {
    expect(aplicarBusinessPack.name).toBe("aplicarBusinessPack");
    expect(pack.specialties.every((s) => Array.isArray(s.tool_ids))).toBe(true);
  });
});
