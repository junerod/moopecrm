import { describe, expect, it } from "vitest";

import { formatarEsperaEmSegundos, resumoDaFila } from "./formato-espera";

describe("resumoDaFila", () => {
  it("fila vazia", () => {
    expect(resumoDaFila({ queue_size: 0, oldest_wait_seconds: 0 })).toEqual({
      titulo: "Fila",
      detalhe: "vazia",
    });
  });

  it("expõe espera da mais antiga", () => {
    expect(resumoDaFila({ queue_size: 8, oldest_wait_seconds: 17 * 60 })).toEqual({
      titulo: "Fila",
      detalhe: "8 aguardando · mais antiga: 17 min",
    });
  });
});

describe("formatarEsperaEmSegundos", () => {
  it("minutos e horas", () => {
    expect(formatarEsperaEmSegundos(40)).toBe("1 min");
    expect(formatarEsperaEmSegundos(120)).toBe("2 min");
    expect(formatarEsperaEmSegundos(3600)).toBe("1 h");
  });
});
