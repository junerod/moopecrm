import { describe, expect, it } from "vitest";

import {
  ehAcaoDeHoje,
  estadoDaProximaAcao,
  rotuloDoAtraso,
  rotuloDoQuando,
  quandoDoPreset,
} from "./proxima-acao";

const AGORA = new Date("2026-09-12T14:00:00.000-03:00");

describe("estadoDaProximaAcao", () => {
  it("sem texto é sem ação", () => {
    expect(estadoDaProximaAcao({ texto: null, em: null }, AGORA)).toBe("sem");
    expect(estadoDaProximaAcao({ texto: "  ", em: AGORA }, AGORA)).toBe("sem");
  });
  it("texto futuro ou sem data é aberta", () => {
    expect(estadoDaProximaAcao({ texto: "Ligar", em: null }, AGORA)).toBe("aberta");
    expect(
      estadoDaProximaAcao({ texto: "Ligar", em: "2026-09-12T18:00:00.000-03:00" }, AGORA),
    ).toBe("aberta");
  });
  it("texto no passado é atrasada", () => {
    expect(
      estadoDaProximaAcao({ texto: "Ligar", em: "2026-09-12T10:00:00.000-03:00" }, AGORA),
    ).toBe("atrasada");
  });
  it("concluída vence o texto", () => {
    expect(
      estadoDaProximaAcao(
        { texto: "Ligar", em: "2026-09-12T10:00:00.000-03:00", concluida: true },
        AGORA,
      ),
    ).toBe("concluida");
  });
});

describe("rotuloDoAtraso", () => {
  it("null se não venceu", () => {
    expect(rotuloDoAtraso("2026-09-12T18:00:00.000-03:00", AGORA)).toBeNull();
    expect(rotuloDoAtraso(null, AGORA)).toBeNull();
  });
  it("minutos / horas / dias", () => {
    expect(rotuloDoAtraso("2026-09-12T13:33:00.000-03:00", AGORA)).toBe("Atrasado 27 min");
    expect(rotuloDoAtraso("2026-09-12T12:00:00.000-03:00", AGORA)).toBe("Atrasado 2 h");
    expect(rotuloDoAtraso("2026-09-10T14:00:00.000-03:00", AGORA)).toBe("Atrasado 2 dias");
  });
});

describe("rotuloDoQuando / presets", () => {
  it("hoje / amanhã", () => {
    expect(rotuloDoQuando("2026-09-12T15:00:00.000-03:00", AGORA)).toBe("Hoje 15:00");
    expect(rotuloDoQuando("2026-09-13T10:00:00.000-03:00", AGORA)).toBe("Amanhã 10:00");
  });
  it("presets não inventam data no passado", () => {
    const hoje = quandoDoPreset("hoje", AGORA);
    expect(hoje.getTime()).toBeGreaterThan(AGORA.getTime());
    const amanha = quandoDoPreset("amanha", AGORA);
    expect(amanha.getDate()).toBe(13);
    expect(amanha.getHours()).toBe(10);
  });
  it("ehAcaoDeHoje", () => {
    expect(ehAcaoDeHoje("2026-09-12T23:00:00.000-03:00", AGORA)).toBe(true);
    expect(ehAcaoDeHoje("2026-09-13T01:00:00.000-03:00", AGORA)).toBe(false);
  });
});
