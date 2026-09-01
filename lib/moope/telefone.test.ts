import { describe, expect, it } from "vitest";

import { cpfOuCnpjDigitos, telefoneE164 } from "@/lib/moope/telefone";

describe("telefoneE164 — o mesmo do person.upserted", () => {
  it("já em E.164 passa", () => {
    expect(telefoneE164("+5511999998888")).toBe("+5511999998888");
  });

  it("dígitos viram +", () => {
    expect(telefoneE164("5511999998888")).toBe("+5511999998888");
  });

  it("recusa lixo", () => {
    expect(telefoneE164("abc")).toBeUndefined();
    expect(telefoneE164("")).toBeUndefined();
    expect(telefoneE164(null)).toBeUndefined();
  });
});

describe("cpfOuCnpjDigitos", () => {
  it("aceita 11 ou 14 dígitos com máscara", () => {
    expect(cpfOuCnpjDigitos("123.456.789-09")).toBe("12345678909");
    expect(cpfOuCnpjDigitos("12.345.678/0001-90")).toBe("12345678000190");
  });

  it("recusa tamanho errado", () => {
    expect(cpfOuCnpjDigitos("123")).toBeUndefined();
    expect(cpfOuCnpjDigitos("")).toBeUndefined();
  });
});
