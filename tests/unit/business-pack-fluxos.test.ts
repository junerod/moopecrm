import { describe, expect, it } from "vitest";

import { catalogoDePacks, resolverPack } from "@/lib/business-packs/catalogo";
import { fluxosProntosDoPack, tituloDoTemplateDoFluxo } from "@/lib/business-packs/sementes";
import { BUSINESS_PACK_IDS } from "@/lib/business-packs/tipos";
import { ajusteFluxoDoPackSchema, montarFluxosNaTela } from "@/lib/negocio/fluxos-do-pack";
import { grafoDoFluxoPronto, quandoDoFluxo } from "@/lib/negocio/grafos-do-pack";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";

const TEMPLATE = "00000000-0000-4000-8000-000000000001";
const TEMPLATE2 = "00000000-0000-4000-8000-000000000002";
const ETAPA = "00000000-0000-4000-8000-0000000000aa";

describe("fluxos prontos dos Packs", () => {
  it("todos os packs têm um modelo operacional e os atalhos", () => {
    expect(BUSINESS_PACK_IDS).toHaveLength(6);
    for (const id of BUSINESS_PACK_IDS) {
      const pack = resolverPack(id)!;
      expect(pack.followups.length).toBeGreaterThanOrEqual(5);
      const modelo = pack.followups.find((f) => f.key === "modelo-operacao");
      expect(modelo?.com_condicao).toBe(true);
      expect(modelo?.message_2?.trim().length).toBeGreaterThan(10);
      expect(modelo?.passos?.length).toBeGreaterThanOrEqual(5);
      expect(modelo?.como_usar?.trim().length).toBeGreaterThan(20);
      expect(modelo?.destaque).toBe(true);
      for (const f of pack.followups) {
        expect(f.message.trim().length).toBeGreaterThan(10);
        expect(f.description.trim().length).toBeGreaterThan(10);
        if (f.kind === "silence") expect(f.threshold_minutes).toBeGreaterThanOrEqual(5);
        if (f.kind === "stage_change") expect(f.stage_name?.length).toBeGreaterThan(0);
      }
    }
  });

  it("cada tipo de negócio tem texto próprio no modelo", () => {
    const locadora = resolverPack("locadora_veiculos")!.followups.find((f) => f.key === "modelo-operacao")!;
    const clinica = resolverPack("clinica_medica")!.followups.find((f) => f.key === "modelo-operacao")!;
    const advocacia = resolverPack("escritorio_advocacia")!.followups.find((f) => f.key === "modelo-operacao")!;
    expect(locadora.message).toMatch(/cotação da locação/i);
    expect(clinica.message).toMatch(/agendar/i);
    expect(clinica.como_usar).toMatch(/sem falar de doença/i);
    expect(advocacia.como_usar).toMatch(/sem parecer/i);
    expect(locadora.message).not.toBe(clinica.message);
  });

  it("grafos validam para publicar — silêncio, etapa e modelo com condição", () => {
    const seeds = fluxosProntosDoPack({
      quem: "da locadora",
      proposta: "Cotação / Proposta",
      agendamento: "Reserva / Documentação",
      ganho: "Fechado — Locação",
    });
    for (const seed of seeds) {
      const graph = grafoDoFluxoPronto(
        seed,
        { primeira: TEMPLATE, segunda: TEMPLATE2 },
        ETAPA,
      );
      const v = validateFlowForPublish(graph);
      expect(v.ok, `${seed.key}: ${v.ok ? "" : v.errors.map((e) => e.code).join(",")}`).toBe(true);
    }
    const modelo = seeds.find((s) => s.key === "modelo-operacao")!;
    const graph = grafoDoFluxoPronto(modelo, { primeira: TEMPLATE, segunda: TEMPLATE2 }, ETAPA);
    expect(graph.nodes.filter((n) => n.type === "condition")).toHaveLength(2);
    expect(graph.nodes.filter((n) => n.type === "action")).toHaveLength(2);
  });

  it("quando do fluxo é frase de leigo, sem id interno", () => {
    const seed = fluxosProntosDoPack({
      quem: "comercial",
      proposta: "Proposta enviada",
      agendamento: "Aguardando fechamento",
      ganho: "Fechado",
    }).find((f) => f.key === "apos-proposta")!;
    expect(quandoDoFluxo(seed)).toMatch(/Proposta enviada/);
    expect(quandoDoFluxo(seed)).not.toMatch(/stage_id|uuid/i);
  });

  it("textos não inventam preço, diagnóstico nem cláusula", () => {
    const texto = catalogoDePacks()
      .map((c) => resolverPack(c.id)!)
      .flatMap((p) => p.followups.flatMap((f) => [f.message, f.message_2 ?? "", f.como_usar ?? ""]))
      .join("\n");
    expect(texto).not.toMatch(/R\$\s*\d/);
    expect(texto.toLowerCase()).not.toMatch(/diagnóstico|prescrição|remédio|jurisprudência/);
  });

  it("montar tela usa o texto gravado e o status do pointer", () => {
    const pack = resolverPack("comercial_geral")!;
    const seed = pack.followups.find((f) => f.key === "silencio-2h")!;
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
    const card = tela.find((f) => f.key === seed.key);
    expect(card?.ativo).toBe(true);
    expect(card?.mensagem).toBe("Texto que o dono editou.");
    const modelo = tela.find((f) => f.key === "modelo-operacao");
    expect(modelo?.destaque).toBe(true);
    expect(modelo?.mensagem2?.length).toBeGreaterThan(10);
  });

  it("ajuste exige a chave do fluxo", () => {
    expect(ajusteFluxoDoPackSchema.safeParse({}).success).toBe(false);
    expect(ajusteFluxoDoPackSchema.safeParse({ key: "silencio-2h", mensagem: "Oi" }).success).toBe(true);
    expect(
      ajusteFluxoDoPackSchema.safeParse({
        key: "modelo-operacao",
        mensagem: "Oi",
        mensagem_2: "Oi de novo",
      }).success,
    ).toBe(true);
  });
});
