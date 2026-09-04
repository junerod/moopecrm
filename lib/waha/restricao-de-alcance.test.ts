import { describe, expect, it } from "vitest";

import { ehRestricaoDeAlcance } from "./restricao-de-alcance";

describe("ehRestricaoDeAlcance", () => {
  it("reconhece o 463 / tctoken do WhatsApp", () => {
    expect(ehRestricaoDeAlcance(new Error("waha_500: error 463: account restricted or missing tctoken"))).toBe(
      true,
    );
    expect(ehRestricaoDeAlcance("RESTRICT_ALL_COMPANIONS")).toBe(true);
    expect(ehRestricaoDeAlcance("reachoutTimelock isActive")).toBe(true);
  });

  it("não confunde queda de rede com bloqueio de alcance", () => {
    expect(ehRestricaoDeAlcance(new Error("waha_502: bad gateway"))).toBe(false);
    expect(ehRestricaoDeAlcance("fetch failed")).toBe(false);
  });
});
