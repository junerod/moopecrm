import { describe, expect, it } from "vitest";

import {
  filtrarCamposExtraidos,
  montarSystemDoCopiloto,
  overlayDoPipeline,
} from "@/lib/ai/copiloto/overlay";
import { definitionLocacao } from "@/lib/ready-models/modelos/locacao";
import { DEFINITION_ADVOCACIA } from "@/lib/ready-models/modelos/advocacia";

describe("overlay do Copilot", () => {
  it("lê instrução e fields do pipeline — sem if de segmento", () => {
    const loc = overlayDoPipeline({
      fields: definitionLocacao("imoveis").fields,
      copilot_overlay: definitionLocacao("imoveis").copilotOverlay,
    });
    expect(loc.instruction).toMatch(/locação de bens/i);
    expect(loc.fieldKeys).toContain("item_tipo");
    expect(loc.fieldLabels.find((f) => f.key === "item_tipo")?.label).toBe("Imóvel");

    const adv = overlayDoPipeline({
      fields: DEFINITION_ADVOCACIA.fields,
      copilot_overlay: DEFINITION_ADVOCACIA.copilotOverlay,
    });
    expect(adv.instruction).toMatch(/não forneça aconselhamento jurídico/i);
  });

  it("extractedFields só fica com keys conhecidas", () => {
    const filtrado = filtrarCamposExtraidos(
      { item_tipo: "andaime", preco_inventado: "10", vazio: "" },
      ["item_tipo"],
    );
    expect(filtrado).toEqual({ item_tipo: "andaime" });
  });

  it("system inclui a instrução do modelo", () => {
    const overlay = overlayDoPipeline({
      fields: DEFINITION_ADVOCACIA.fields,
      copilot_overlay: DEFINITION_ADVOCACIA.copilotOverlay,
    });
    const system = montarSystemDoCopiloto("BASE.", overlay);
    expect(system).toContain("BASE.");
    expect(system).toContain("area_juridica");
    expect(system).toMatch(/aconselhamento jurídico/i);
  });
});
