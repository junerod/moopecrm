import { describe, expect, it } from "vitest";

import { horasNoEstagio, posicaoNoFim, vocabularioDoFunil } from "@/lib/moope/funil-quadro";

describe("quadro do funil para o parceiro", () => {
  it("solta o card no fim da etapa, um passo depois do último", () => {
    expect(posicaoNoFim(null)).toBe(1000);
    expect(posicaoNoFim(3000)).toBe(4000);
  });

  it("usa o vocabulário do funil e cai no padrão quando não há", () => {
    expect(vocabularioDoFunil({ won: "Contrato", lost: "Desistiu" })).toMatchObject({
      won: "Contrato",
      lost: "Desistiu",
      lead: "Negócio",
    });
    expect(vocabularioDoFunil(null)).toEqual({ lead: "Negócio", won: "Ganho", lost: "Perdido" });
  });

  it("mede as horas pela última atividade", () => {
    const horas = horasNoEstagio("2026-10-22T12:00:00.000Z", "2026-01-01T00:00:00.000Z", new Date("2026-10-22T15:00:00.000Z"));
    expect(horas).toBe(3);
  });
});
