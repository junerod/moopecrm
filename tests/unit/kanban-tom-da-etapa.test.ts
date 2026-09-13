import { describe, expect, it } from "vitest";

import { tomDaEtapa, tomDaTemperatura, TOMS_ETAPA } from "@/lib/kanban/tom-da-etapa";

describe("tom da etapa do kanban", () => {
  it("ganho e perdido têm tom fixo, as demais ciclam a paleta", () => {
    expect(tomDaEtapa({ is_won: true, is_lost: false }, 99)).toBe("green");
    expect(tomDaEtapa({ is_won: false, is_lost: true }, 0)).toBe("red");
    expect(tomDaEtapa({ is_won: false, is_lost: false }, 0)).toBe("blue");
    expect(tomDaEtapa({ is_won: false, is_lost: false }, 5)).toBe(TOMS_ETAPA[0]);
  });

  it("temperatura usa tons semânticos, sem emoji", () => {
    expect(tomDaTemperatura("frio")).toBe("cyan");
    expect(tomDaTemperatura("morno")).toBe("amber");
    expect(tomDaTemperatura("quente")).toBe("red");
    expect(tomDaTemperatura(null)).toBeNull();
  });
});
