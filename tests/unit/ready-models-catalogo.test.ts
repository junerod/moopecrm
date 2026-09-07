import { describe, expect, it } from "vitest";

import { resolverDefinition, catalogoParaWizard } from "@/lib/ready-models/catalogo";
import { definitionLocacao } from "@/lib/ready-models/modelos/locacao";

describe("catálogo de Ready Models", () => {
  it("expõe os cinco modelos do MVP", () => {
    expect(catalogoParaWizard().map((c) => c.id)).toEqual([
      "locacao",
      "advocacia",
      "comercial",
      "servicos",
      "personalizado",
    ]);
  });

  it("locacao@1.0 instala definition com key estável item_tipo", () => {
    const d = resolverDefinition("locacao");
    expect(d?.id).toBe("locacao");
    expect(d?.version).toBe("1.0");
    expect(d?.fields.some((f) => f.key === "item_tipo")).toBe(true);
  });

  it("subtype muda label, não a key", () => {
    const maq = definitionLocacao("maquinas_e_equipamentos");
    const vei = definitionLocacao("veiculos");
    expect(maq.fields.find((f) => f.key === "item_tipo")?.label).toBe("Equipamento");
    expect(vei.fields.find((f) => f.key === "item_tipo")?.label).toBe("Veículo");
    expect(maq.pipeline.etapas.map((e) => e.nome)).toEqual(vei.pipeline.etapas.map((e) => e.nome));
  });

  it("aliases antigos resolvem sem o instalador conhecer nicho", () => {
    expect(resolverDefinition("locadora")?.id).toBe("locacao");
    expect(resolverDefinition("loja")?.id).toBe("comercial");
    expect(resolverDefinition("generico")?.id).toBe("personalizado");
  });

  it("advocacia não carrega TOOLS_LOCADORA nem cobrança", () => {
    const src = JSON.stringify(resolverDefinition("advocacia"));
    expect(src).not.toMatch(/TOOLS_LOCADORA|Cobrança|veículo/i);
  });
});
