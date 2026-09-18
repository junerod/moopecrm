import { describe, expect, it } from "vitest";

import { estaDentroDoHorario } from "./horario";

const janela = {
  filters: {
    business_hours: {
      timezone: "America/Sao_Paulo",
      start: "08:00",
      end: "18:00",
      weekdays: [1, 2, 3, 4, 5],
    },
  },
};

describe("estaDentroDoHorario", () => {
  it("sem janela = dentro (falha aberta)", () => {
    expect(estaDentroDoHorario(null, new Date("2026-09-16T21:00:00.000Z"))).toBe(true);
    expect(estaDentroDoHorario({}, new Date("2026-09-16T21:00:00.000Z"))).toBe(true);
  });

  it("terça 12h BRT está dentro", () => {
    // 2026-09-16 15:00 UTC = 12:00 em São Paulo
    expect(estaDentroDoHorario(janela, new Date("2026-09-16T15:00:00.000Z"))).toBe(true);
  });

  it("terça 21h BRT está fora", () => {
    expect(estaDentroDoHorario(janela, new Date("2026-09-17T00:00:00.000Z"))).toBe(false);
  });
});
