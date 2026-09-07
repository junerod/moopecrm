import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { filtrarCustomFieldsDoPipeline, camposDoPipeline } from "@/lib/leads/custom-fields";
import { definitionLocacao } from "@/lib/ready-models/modelos/locacao";
import { updateLeadSchema } from "@/lib/schemas/leads";

describe("custom fields do Ready Model", () => {
  const settings = { fields: definitionLocacao("ferramentas").fields };

  it("fields vêm do pipeline e subtype só muda label", () => {
    const vei = camposDoPipeline({ fields: definitionLocacao("veiculos").fields });
    const fer = camposDoPipeline(settings);
    expect(vei.map((f) => f.key)).toEqual(fer.map((f) => f.key));
    expect(vei.find((f) => f.key === "item_tipo")?.label).toBe("Veículo");
    expect(fer.find((f) => f.key === "item_tipo")?.label).toBe("Ferramenta");
  });

  it("aceita keys conhecidas e ignora key inventada", () => {
    const r = filtrarCustomFieldsDoPipeline(settings, {
      item_tipo: "furadeira",
      campo_inventado: "x",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ item_tipo: "furadeira" });
      expect(r.value.campo_inventado).toBeUndefined();
    }
  });

  it("rejeita tipo inválido em key conhecida", () => {
    const r = filtrarCustomFieldsDoPipeline(settings, { quantidade: "muito" });
    expect(r.ok).toBe(false);
  });

  it("PATCH schema aceita custom_fields", () => {
    const parsed = updateLeadSchema.safeParse({
      title: "Furadeira",
      custom_fields: { item_tipo: "furadeira" },
    });
    expect(parsed.success).toBe(true);
  });

  it("o PATCH do lead filtra organization_id no funil e no update", () => {
    const src = readFileSync("app/api/v1/leads/_handler.ts", "utf8");
    const bloco = src.split("if (input.custom_fields !== undefined)")[1]?.slice(0, 900) ?? "";
    expect(bloco).toMatch(/organization_id/);
    expect(bloco).toMatch(/pipeline_id/);
    expect(src).toMatch(/\.eq\("organization_id", ctx\.organization_id\)[\s\S]{0,200}\.eq\("id", leadId\)/);
  });
});
