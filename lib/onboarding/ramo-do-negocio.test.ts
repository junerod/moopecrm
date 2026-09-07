import { describe, expect, it } from "vitest";

import { RAMOS_DO_NEGOCIO, textoDoRamo } from "@/lib/onboarding/ramo-do-negocio";

describe("ramos do primeiro passo", () => {
  it("as cinco portas do Simple Mode", () => {
    expect(RAMOS_DO_NEGOCIO.map((r) => r.id)).toEqual([
      "locacao",
      "advocacia",
      "comercial",
      "servicos",
      "personalizado",
    ]);
  });

  it("locação com subtype vira prosa, não jargão de veículo", () => {
    expect(textoDoRamo("locacao", undefined, "maquinas_e_equipamentos")).toBe(
      "Locação — Máquinas e equipamentos",
    );
    expect(textoDoRamo("advocacia")).toBe("Escritório de advocacia");
  });
});
