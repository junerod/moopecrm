import { describe, expect, it } from "vitest";

import {
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
  });
});
