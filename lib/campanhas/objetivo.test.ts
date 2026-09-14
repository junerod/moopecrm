import { describe, expect, it } from "vitest";

import {
  CARDS_DE_OBJETIVO,
  modeloCombinaComObjetivo,
  rascunhoDoObjetivo,
} from "@/lib/campanhas/objetivo";

describe("objetivo da campanha", () => {
  it("cada objetivo tem rascunho próprio, menos a personalizada", () => {
    const textos = CARDS_DE_OBJETIVO.filter((c) => c.id !== "personalizada").map((c) => c.rascunho);
    expect(new Set(textos).size).toBe(textos.length);
    expect(rascunhoDoObjetivo("pesquisa")).toMatch(/experiência/i);
    expect(rascunhoDoObjetivo("personalizada")).toBe("");
  });

  it("sugere modelo do Pack pelo título", () => {
    expect(modeloCombinaComObjetivo("Volte a alugar com a gente", "reativacao")).toBe(true);
    expect(modeloCombinaComObjetivo("Como foi sua experiência?", "pesquisa")).toBe(true);
    expect(modeloCombinaComObjetivo("Como foi sua experiência?", "promocao")).toBe(false);
  });
});
