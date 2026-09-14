import { describe, expect, it } from "vitest";

import { fonteAtivaDoPack, montarChecklistDoPack } from "@/lib/business-packs/checklist";
import { montarBlocoPack } from "@/lib/business-packs/perfil";
import type { PackArtifacts } from "@/lib/business-packs/tipos";

const COL_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COL_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const AG_1 = "11111111-1111-4111-8111-111111111111";
const AG_2 = "22222222-2222-4222-8222-222222222222";
const AUTO_1 = "33333333-3333-4333-8333-333333333333";
const AUTO_2 = "44444444-4444-4444-8444-444444444444";
const VERSAO = "55555555-5555-4555-8555-555555555555";

function artifacts(extra: Partial<PackArtifacts> = {}): PackArtifacts {
  return {
    agent_keys: { recepcao: AG_1, comercial: AG_2 },
    collection_slugs: { atendimento: COL_A },
    template_keys: {},
    automation_keys: { lead: AUTO_1, followup: AUTO_2 },
    campaign_keys: {},
    followup_keys: {},
    ...extra,
  };
}

function packAtivo(arts = artifacts()) {
  return montarBlocoPack("locadora_veiculos", "1.0", arts);
}

function packAdvocacia(arts = artifacts()) {
  return montarBlocoPack("escritorio_advocacia", "1.0", arts);
}

const vazio = {
  sessoes: [] as Array<{ id: string; status: string | null; phone_number: string | null }>,
  fontes: [] as Array<{ is_active: boolean | null; status: string | null; source_metadata: unknown }>,
  agentes: [] as Array<{ id: string; published_version_id: string | null }>,
  automacoes: [] as Array<{ id: string; is_active: boolean | null }>,
};

describe("checklist pós-ativação", () => {
  it("sem Pack não mostra checklist", () => {
    expect(montarChecklistDoPack({ pack: null, ...vazio })).toBeNull();
  });

  it("Pack instalado e desativado não mostra checklist", () => {
    const pack = { ...packAtivo(), status: "inactive" as const };
    expect(montarChecklistDoPack({ pack, ...vazio })).toBeNull();
  });

  it("Pack instalado começa 0 de 4", () => {
    const c = montarChecklistDoPack({ pack: packAtivo(), ...vazio });
    expect(c?.concluidos).toBe(0);
    expect(c?.total).toBe(4);
    expect(c?.pronto).toBe(false);
    expect(c?.itens.map((i) => i.id)).toEqual(["whatsapp", "knowledge", "assistentes", "automacao"]);
    expect(c?.itens.find((i) => i.id === "whatsapp")?.status).toBe("Não conectado");
    expect(c?.itens.find((i) => i.id === "automacao")?.status).toBe("Nenhuma ativa");
    expect(c?.itens.find((i) => i.id === "assistentes")?.status).toBe("0 de 2 publicados");
  });

  it("WhatsApp só conta sessão WORKING com número", () => {
    const semNumero = montarChecklistDoPack({
      pack: packAtivo(),
      ...vazio,
      sessoes: [{ id: "s1", status: "WORKING", phone_number: null }],
    });
    expect(semNumero?.itens.find((i) => i.id === "whatsapp")?.feito).toBe(false);

    const ok = montarChecklistDoPack({
      pack: packAtivo(),
      ...vazio,
      sessoes: [{ id: "s1", status: "WORKING", phone_number: "+5531999990000" }],
    });
    expect(ok?.itens.find((i) => i.id === "whatsapp")?.feito).toBe(true);
    expect(ok?.itens.find((i) => i.id === "whatsapp")?.status).toBe("Conectado");
    expect(ok?.concluidos).toBe(1);
  });

  it("Knowledge exige fonte ativa na coleção do Pack — genérica não conta", () => {
    expect(fonteAtivaDoPack([], [COL_A])).toBe(false);
    expect(
      fonteAtivaDoPack(
        [{ is_active: true, status: "ready", source_metadata: {} }],
        [COL_A],
      ),
    ).toBe(false);
    expect(
      fonteAtivaDoPack(
        [{ is_active: true, status: "ready", source_metadata: { collection_ids: [COL_B] } }],
        [COL_A],
      ),
    ).toBe(false);
    expect(
      fonteAtivaDoPack(
        [{ is_active: true, status: "ready", source_metadata: { collection_ids: [COL_A] } }],
        [COL_A],
      ),
    ).toBe(true);
    expect(
      fonteAtivaDoPack(
        [{ is_active: false, status: "ready", source_metadata: { collection_ids: [COL_A] } }],
        [COL_A],
      ),
    ).toBe(false);

    const c = montarChecklistDoPack({
      pack: packAtivo(),
      ...vazio,
      fontes: [{ is_active: true, status: "ready", source_metadata: { collection_ids: [COL_A] } }],
    });
    expect(c?.itens.find((i) => i.id === "knowledge")?.feito).toBe(true);
  });

  it("publicação parcial não conclui assistentes", () => {
    const parcial = montarChecklistDoPack({
      pack: packAtivo(),
      ...vazio,
      agentes: [
        { id: AG_1, published_version_id: VERSAO },
        { id: AG_2, published_version_id: null },
      ],
    });
    expect(parcial?.itens.find((i) => i.id === "assistentes")?.feito).toBe(false);
    expect(parcial?.itens.find((i) => i.id === "assistentes")?.status).toBe("1 de 2 publicados");
  });

  it("publicação completa conclui assistentes", () => {
    const ok = montarChecklistDoPack({
      pack: packAtivo(),
      ...vazio,
      agentes: [
        { id: AG_1, published_version_id: VERSAO },
        { id: AG_2, published_version_id: VERSAO },
      ],
    });
    expect(ok?.itens.find((i) => i.id === "assistentes")?.feito).toBe(true);
    expect(ok?.itens.find((i) => i.id === "assistentes")?.status).toBe("2 de 2 publicados");
  });

  it("automação do Pack desligada não conta; uma ligada conta", () => {
    const nenhuma = montarChecklistDoPack({
      pack: packAtivo(),
      ...vazio,
      automacoes: [
        { id: AUTO_1, is_active: false },
        { id: AUTO_2, is_active: false },
      ],
    });
    expect(nenhuma?.itens.find((i) => i.id === "automacao")?.feito).toBe(false);

    const uma = montarChecklistDoPack({
      pack: packAtivo(),
      ...vazio,
      automacoes: [
        { id: AUTO_1, is_active: true },
        { id: AUTO_2, is_active: false },
      ],
    });
    expect(uma?.itens.find((i) => i.id === "automacao")?.feito).toBe(true);
    expect(uma?.itens.find((i) => i.id === "automacao")?.status).toBe("1 ativa");
  });

  it("artefato só instalado pelo Pack não marca feito", () => {
    const c = montarChecklistDoPack({
      pack: packAtivo(),
      ...vazio,
      agentes: [
        { id: AG_1, published_version_id: null },
        { id: AG_2, published_version_id: null },
      ],
      automacoes: [{ id: AUTO_1, is_active: false }],
    });
    expect(c?.itens.every((i) => !i.feito)).toBe(true);
  });

  it("4 de 4 é Pronto para trabalhar", () => {
    const c = montarChecklistDoPack({
      pack: packAtivo(),
      sessoes: [{ id: "s", status: "WORKING", phone_number: "5531999" }],
      fontes: [{ is_active: true, status: "ready", source_metadata: { collection_ids: [COL_A] } }],
      agentes: [
        { id: AG_1, published_version_id: VERSAO },
        { id: AG_2, published_version_id: VERSAO },
      ],
      automacoes: [{ id: AUTO_1, is_active: true }],
    });
    expect(c?.concluidos).toBe(4);
    expect(c?.pronto).toBe(true);
  });

  it("reaplicar (mesmo estado) não zera progresso", () => {
    const fatos = {
      pack: packAtivo(),
      sessoes: [{ id: "s", status: "WORKING", phone_number: "5531999" }],
      fontes: [{ is_active: true, status: "ready", source_metadata: { collection_ids: [COL_A] } }],
      agentes: [
        { id: AG_1, published_version_id: VERSAO },
        { id: AG_2, published_version_id: VERSAO },
      ],
      automacoes: [{ id: AUTO_1, is_active: true }],
    };
    const antes = montarChecklistDoPack(fatos);
    const depois = montarChecklistDoPack(fatos);
    expect(depois).toEqual(antes);
    expect(depois?.pronto).toBe(true);
  });

  it("Locadora e Advocacia usam o mesmo montador", () => {
    const loc = montarChecklistDoPack({ pack: packAtivo(), ...vazio });
    const adv = montarChecklistDoPack({ pack: packAdvocacia(), ...vazio });
    expect(loc?.packId).toBe("locadora_veiculos");
    expect(adv?.packId).toBe("escritorio_advocacia");
    expect(loc?.itens.map((i) => i.id)).toEqual(adv?.itens.map((i) => i.id));
  });

  it("tenant isolation: ids de outro tenant não concluem o Pack", () => {
    const c = montarChecklistDoPack({
      pack: packAtivo(),
      sessoes: [],
      fontes: [
        {
          is_active: true,
          status: "ready",
          source_metadata: { collection_ids: ["zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz"] },
        },
      ],
      agentes: [{ id: "99999999-9999-4999-8999-999999999999", published_version_id: VERSAO }],
      automacoes: [{ id: "88888888-8888-4888-8888-888888888888", is_active: true }],
    });
    expect(c?.itens.find((i) => i.id === "knowledge")?.feito).toBe(false);
    expect(c?.itens.find((i) => i.id === "assistentes")?.feito).toBe(false);
    expect(c?.itens.find((i) => i.id === "automacao")?.feito).toBe(false);
  });
});
