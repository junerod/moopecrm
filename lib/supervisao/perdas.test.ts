import { describe, expect, it } from "vitest";

import { agregarMotivosDePerda } from "./kpis";

describe("agregarMotivosDePerda", () => {
  it("agrupa o motivo que o humano gravou, sem inventar", () => {
    const rows = agregarMotivosDePerda([
      { lost_reason: "Preço", value_cents: 50000 },
      { lost_reason: "Preço", value_cents: 20000 },
      { lost_reason: "Concorrente", value_cents: 10000 },
      { lost_reason: "  ", value_cents: null },
      { lost_reason: null, value_cents: 0 },
    ]);
    expect(rows[0]).toEqual({ motivo: "Preço", quantidade: 2, valor_cents: 70000 });
    expect(rows.find((r) => r.motivo === "Concorrente")).toEqual({
      motivo: "Concorrente",
      quantidade: 1,
      valor_cents: 10000,
    });
    expect(rows.find((r) => r.motivo === "Sem motivo")).toEqual({
      motivo: "Sem motivo",
      quantidade: 2,
      valor_cents: 0,
    });
  });

  it("lista vazia não inventa linha", () => {
    expect(agregarMotivosDePerda([])).toEqual([]);
  });
});
