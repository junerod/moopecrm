import { describe, expect, it } from "vitest";

import {
  detalhesDoPack,
  especialidadeDoAgente,
  packEstaAtivo,
  resumoDoPack,
  TEXTO_DO_PACK,
} from "@/lib/business-packs/apresentacao";
import { PACK_LOCADORA_VEICULOS } from "@/lib/business-packs/modelos/locadora-veiculos";

describe("apresentação do Pack Locadora", () => {
  it("marca recepção como principal e lê a chave gravada no config", () => {
    const spec = especialidadeDoAgente(
      { name: "Outro nome", config: { pack_specialty_key: "financeiro" } },
      PACK_LOCADORA_VEICULOS,
    );
    expect(spec?.key).toBe("financeiro");
    expect(spec?.isPrincipal).toBe(false);
    expect(TEXTO_DO_PACK.financeiro?.oQueFaz).toMatch(/boleto/i);

    const recepcao = especialidadeDoAgente(
      { name: "Atendimento da Locadora", config: {} },
      PACK_LOCADORA_VEICULOS,
    );
    expect(recepcao?.isPrincipal).toBe(true);
  });

  it("não trata Assistente da empresa como especialidade do pack", () => {
    expect(
      especialidadeDoAgente({ name: "Assistente da empresa", config: {} }, PACK_LOCADORA_VEICULOS),
    ).toBeNull();
  });

  it("resume o que o pack instala sem ids internos", () => {
    const r = resumoDoPack(PACK_LOCADORA_VEICULOS);
    expect(r.assistentes).toBe(6);
    expect(r.etapas).toBe(8);
    expect(r.colecoes).toBe(4);
    expect(packEstaAtivo(null)).toBe(false);
    expect(
      packEstaAtivo({
        id: "locadora_veiculos",
        version: "1.0",
        installed_at: "2026-01-01T00:00:00.000Z",
        artifacts: {
          agent_keys: {},
          collection_slugs: {},
          template_keys: {},
          automation_keys: {},
          campaign_keys: {},
          followup_keys: {},
        },
      }),
    ).toBe(true);
    expect(
      packEstaAtivo({
        id: "locadora_veiculos",
        version: "1.0",
        installed_at: "2026-01-01T00:00:00.000Z",
        status: "inactive",
        artifacts: {
          agent_keys: {},
          collection_slugs: {},
          template_keys: {},
          automation_keys: {},
          campaign_keys: {},
          followup_keys: {},
        },
      }),
    ).toBe(false);
  });

  it("lista os 6 assistentes com o que cada um faz, sem ids internos", () => {
    const d = detalhesDoPack(PACK_LOCADORA_VEICULOS);
    expect(d.assistentes).toHaveLength(6);
    expect(d.assistentes.map((a) => a.name)).toEqual([
      "Atendimento da Locadora",
      "Consultor Comercial",
      "Assistente Financeiro",
      "Assistente de Disponibilidade",
      "Atendimento ao Cliente",
      "Relacionamento",
    ]);
    expect(d.assistentes.find((a) => a.principal)?.key).toBe("recepcao");
    expect(d.etapas).toHaveLength(8);
    expect(d.colecoes).toHaveLength(4);
    expect(d.automacoes.every((a) => a.name.length > 0)).toBe(true);
    expect(d.fluxos.length).toBeGreaterThanOrEqual(4);
    expect(d.fluxos.every((f) => f.description.length > 0)).toBe(true);
    expect(JSON.stringify(d)).not.toMatch(/mcp_/);
  });
});
