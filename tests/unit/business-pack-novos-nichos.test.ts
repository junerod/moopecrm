import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { detalhesDoPack, montarLojaDePacks } from "@/lib/business-packs/apresentacao";
import { packParaRamo, resolverPack } from "@/lib/business-packs/catalogo";
import { intentEhSensivel } from "@/lib/business-packs/intents";
import { simularTestDrive } from "@/lib/business-packs/test-drive";
import { BUSINESS_PACK_IDS } from "@/lib/business-packs/tipos";

describe("packs SaaS, comercial e clínicas", () => {
  it("os quatro ids entram no mesmo motor", () => {
    expect(BUSINESS_PACK_IDS).toContain("vendas_saas");
    expect(BUSINESS_PACK_IDS).toContain("comercial_geral");
    expect(BUSINESS_PACK_IDS).toContain("clinica_medica");
    expect(BUSINESS_PACK_IDS).toContain("clinica_odontologica");
    expect(packParaRamo("saas")).toBe("vendas_saas");
    expect(packParaRamo("comercial")).toBe("comercial_geral");
    expect(montarLojaDePacks()).toHaveLength(6);
  });

  it.each(["vendas_saas", "comercial_geral", "clinica_medica", "clinica_odontologica"] as const)(
    "%s tem 6 especialidades, recepção default, copilot e automações",
    (id) => {
      const pack = resolverPack(id)!;
      expect(pack.version).toBe("1.0");
      expect(pack.specialties).toHaveLength(6);
      expect(pack.specialties.filter((s) => s.is_default)).toHaveLength(1);
      expect(pack.specialties.find((s) => s.is_default)?.key).toBe("recepcao");
      expect(pack.pipeline.etapas).toHaveLength(8);
      expect(pack.ai_mode_default).toBe("copilot");
      expect(pack.automations.length).toBeGreaterThanOrEqual(6);
      expect(pack.collections.length).toBe(5);
    },
  );

  it("SaaS não inventa preço nem SLA", () => {
    const pack = resolverPack("vendas_saas")!;
    const preco = simularTestDrive({
      mensagem: "Quanto custa o plano?",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Acme SaaS",
    });
    expect(preco.resposta).not.toMatch(/R\$\s*\d/);
    expect(preco.precisa_humano).toBe(true);
    const sla = simularTestDrive({
      mensagem: "Qual o prazo de implantação?",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Acme SaaS",
    });
    expect(sla.precisa_humano).toBe(true);
    expect(sla.resposta).toMatch(/não afirmo|não invent/i);
  });

  it("clínica médica não herda texto de locadora nos assistentes", () => {
    const d = detalhesDoPack(resolverPack("clinica_medica")!);
    const texto = JSON.stringify(d.assistentes);
    expect(texto).not.toMatch(/locação|locadora|veículo|boleto/i);
    expect(d.assistentes.find((a) => a.key === "atendimento")?.oQueFaz).toMatch(/administrativo/i);
    expect(JSON.stringify(detalhesDoPack(resolverPack("clinica_odontologica")!).assistentes)).not.toMatch(
      /locação|locadora|veículo|boleto/i,
    );
    expect(d.etapas).toEqual([
      "Novo contato",
      "Triagem",
      "Entendendo o caso",
      "Quer agendar",
      "Escolhendo horário",
      "Consulta marcada",
      "Retorno",
      "Não vai marcar",
    ]);
  });

  it("clínica médica não inventa diagnóstico", () => {
    const pack = resolverPack("clinica_medica")!;
    expect(intentEhSensivel("diagnostico")).toBe(true);
    const r = simularTestDrive({
      mensagem: "Qual o diagnóstico?",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Clínica Bem",
    });
    expect(r.precisa_humano).toBe(true);
    expect(r.resposta).toMatch(/não invento diagnóstico/i);
  });

  it("clínica odontológica não inventa plano de tratamento", () => {
    const pack = resolverPack("clinica_odontologica")!;
    const r = simularTestDrive({
      mensagem: "Qual o tratamento?",
      definition: pack,
      gestaoConfigurada: false,
      orgName: "Odonto Sul",
    });
    expect(r.precisa_humano).toBe(true);
    expect(r.resposta).toMatch(/não invento diagnóstico|tratamento/i);
  });

  it("a tela não cola pastas de material no quadro como se fossem assistentes", () => {
    const src = readFileSync("app/app/modelos-prontos/[packId]/_client.tsx", "utf8");
    expect(src).toMatch(/data-testid="quadro-do-modelo"/);
    expect(src).toMatch(/não repete os assistentes/);
    expect(src).not.toMatch(/Funil que o modelo instala/);
    const aposAssistentes = src.split('data-testid="lista-assistentes-do-modelo"')[1] ?? "";
    const blocoQuadro = aposAssistentes.split("Automações")[0] ?? "";
    expect(blocoQuadro).not.toMatch(/colecoes\.map/);
  });
});
