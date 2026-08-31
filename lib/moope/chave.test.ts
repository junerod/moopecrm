import { describe, expect, it } from "vitest";

import {
  chaveBate,
  extrairBearer,
  gerarChaveDeEntrada,
  hashDaChave,
} from "@/lib/moope/chave";

describe("chave MOOPE", () => {
  it("plaintext começa com mop_ e o hash bate só com o original", () => {
    const gerada = gerarChaveDeEntrada();
    expect(gerada.plaintext.startsWith("mop_")).toBe(true);
    expect(gerada.hash).toBe(hashDaChave(gerada.plaintext));
    expect(chaveBate(gerada.plaintext, gerada.hash)).toBe(true);
    expect(chaveBate(`${gerada.plaintext}x`, gerada.hash)).toBe(false);
  });

  it("Bearer só aceita o header certo", () => {
    expect(extrairBearer("Bearer abc")).toBe("abc");
    expect(extrairBearer("bearer abc")).toBe("abc");
    expect(extrairBearer("abc")).toBeNull();
    expect(extrairBearer(null)).toBeNull();
  });
});
