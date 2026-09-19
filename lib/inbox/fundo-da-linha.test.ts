import { describe, expect, it } from "vitest";

import { classeFundoDaLinha, classeFundoDoHeader } from "./fundo-da-linha";

describe("fundo da linha do inbox", () => {
  it("cliente e lead têm fundo próprio; selecionada vence", () => {
    expect(
      classeFundoDaLinha({ papel: "cliente", selecionada: false, zebraImpar: true }),
    ).toContain("inbox-row-cliente");
    expect(
      classeFundoDaLinha({ papel: "lead", selecionada: false, zebraImpar: true }),
    ).toContain("inbox-row-lead");
    expect(classeFundoDaLinha({ papel: "cliente", selecionada: true })).toContain(
      "moope-primary-bg",
    );
  });

  it("sem papel, a zebra antiga continua", () => {
    expect(classeFundoDaLinha({ papel: null, selecionada: false, zebraImpar: true })).toContain(
      "inbox-row-alt",
    );
    expect(classeFundoDaLinha({ papel: null, selecionada: false, zebraImpar: false })).toBe("");
  });

  it("a barra do título usa o mesmo tom do papel", () => {
    expect(classeFundoDoHeader("cliente")).toContain("inbox-row-cliente");
    expect(classeFundoDoHeader(null)).toContain("color-surface");
  });
});
