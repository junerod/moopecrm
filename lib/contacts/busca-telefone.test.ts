import { describe, expect, it } from "vitest";

import { trechosDeTelefoneParaBusca } from "./busca-telefone";

describe("trechosDeTelefoneParaBusca", () => {
  it("aceita máscara brasileira e casa o E.164 gravado", () => {
    const e164 = "+5548999912026";
    for (const q of ["(48) 99991-2026", "48 99991-2026", "99991-2026"]) {
      const trechos = trechosDeTelefoneParaBusca(q);
      expect(trechos.some((t) => e164.includes(t))).toBe(true);
    }
  });

  it("ignora busca curta demais para ser telefone", () => {
    expect(trechosDeTelefoneParaBusca("123")).toEqual([]);
  });
});
