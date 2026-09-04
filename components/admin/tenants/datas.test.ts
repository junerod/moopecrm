import { describe, expect, it } from "vitest";

import { formatarData, formatarDataHora, nomeDoMesCorrente } from "./datas";

describe("datas da ficha do tenant", () => {
  it("mostra o mês por extenso, não o número", () => {
    // 12:24 UTC = 09:24 em Brasília (UTC−3 o ano inteiro desde 2019).
    const texto = formatarDataHora("2026-08-31T12:24:00.000Z");
    expect(texto).toMatch(/31/);
    expect(texto).toMatch(/agosto/i);
    expect(texto).toMatch(/2026/);
    expect(texto).toMatch(/09:24/);
    expect(texto).not.toMatch(/31\/08/);
  });

  it("data curta da lista também traz o mês escrito", () => {
    const texto = formatarData("2026-08-31T12:24:00.000Z");
    expect(texto.toLowerCase()).toMatch(/ago/);
    expect(texto).not.toMatch(/31\/08/);
  });

  it("ausência não inventa data", () => {
    expect(formatarDataHora(null)).toBe("—");
    expect(formatarData(null)).toBe("—");
  });

  it("nome do mês corrente é palavra, não número", () => {
    const nome = nomeDoMesCorrente(new Date("2026-08-15T15:00:00.000Z"));
    expect(nome.toLowerCase()).toBe("agosto");
  });
});
