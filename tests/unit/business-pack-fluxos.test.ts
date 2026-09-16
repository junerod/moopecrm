import { describe, expect, it } from "vitest";

import { catalogoDePacks, resolverPack } from "@/lib/business-packs/catalogo";
import { fluxosProntosDoPack, tituloDoTemplateDoFluxo } from "@/lib/business-packs/sementes";
import { BUSINESS_PACK_IDS } from "@/lib/business-packs/tipos";
import { ajusteFluxoDoPackSchema, montarFluxosNaTela } from "@/lib/negocio/fluxos-do-pack";
import { grafoDoFluxoPronto, quandoDoFluxo } from "@/lib/negocio/grafos-do-pack";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";

const TEMPLATE = "00000000-0000-4000-8000-000000000001";

describe("fluxos prontos dos Packs", () => {
  it("todos os packs têm fluxos com texto e gatilho", () => {
    expect(BUSINESS_PACK_IDS).toHaveLength(6);
    for (const id of BUSINESS_PACK_IDS) {
      const pack = resolverPack(id)!;
      expect(pack.followups.length).toBeGreaterThanOrEqual(4);
      for (const f of pack.followups) {
        expect(f.message.trim().length).toBeGreaterThan(10);
        expect(f.description.trim().length).toBeGreaterThan(10);
        if (f.kind === "silence") expect(f.threshold_minutes).toBeGreaterThanOrEqual(5);
        if (f.kind === "stage_change") expect(f.stage_name?.length).toBeGreaterThan(0);
      }
    }
  });

  it("grafos validam para publicar — silêncio e etapa com espera", () => {
    const seeds = fluxosProntosDoPack({
      quem: "da locadora",
      proposta: "Cotação / Proposta",
      agendamento: "Reserva / Documentação",
      ganho: "Fechado — Locação",
    });
    for (const seed of seeds) {
      const graph = grafoDoFluxoPronto(seed, TEMPLATE);
      const v = validateFlowForPublish(graph);
      expect(v.ok, `${seed.key}: ${v.ok ? "" : v.errors.map((e) => e.code).join(",")}`).toBe(true);
    }
  });

  it("quando do fluxo é frase de leigo, sem id interno", () => {
    const seed = fluxosProntosDoPack({
      quem: "comercial",
      proposta: "Proposta enviada",
      agendamento: "Aguardando fechamento",
      ganho: "Fechado",
    })[1]!;
    expect(quandoDoFluxo(seed)).toMatch(/Proposta enviada/);
    expect(quandoDoFluxo(seed)).not.toMatch(/stage_id|uuid/i);
  });

  it("textos não inventam preço, diagnóstico nem cláusula", () => {
    const texto = catalogoDePacks()
      .map((c) => resolverPack(c.id)!)
      .flatMap((p) => p.followups.map((f) => f.message))
      .join("\n");
    expect(texto).not.toMatch(/R\$\s*\d/);
    expect(texto.toLowerCase()).not.toMatch(/diagnóstico|prescrição|remédio|jurisprudência/);
  });

  it("montar tela usa o texto gravado e o status do pointer", () => {
    const pack = resolverPack("comercial_geral")!;
    const seed = pack.followups[0]!;
    const POINTER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const tela = montarFluxosNaTela(
      pack,
      {
        agent_keys: {},
        collection_slugs: {},
        template_keys: {},
        automation_keys: {},
        campaign_keys: {},
        followup_keys: { [seed.key]: POINTER },
      },
      [{ id: POINTER, status: "active" }],
      [{ title: tituloDoTemplateDoFluxo(seed.key), body: "Texto que o dono editou." }],
    );
    expect(tela[0]?.ativo).toBe(true);
    expect(tela[0]?.mensagem).toBe("Texto que o dono editou.");
  });

  it("ajuste exige a chave do fluxo", () => {
    expect(ajusteFluxoDoPackSchema.safeParse({}).success).toBe(false);
    expect(ajusteFluxoDoPackSchema.safeParse({ key: "silencio-2h", mensagem: "Oi" }).success).toBe(true);
  });
});
