import { describe, expect, it } from "vitest";

import { escolherCredencialPadrao } from "./credencial-padrao";

const TOKEN = "__instalacao__";

function cred(parcial: Partial<{ id: string; provider: string; is_active: boolean; validated_at: string | null; validation_error: string | null }> = {}) {
  return {
    id: "c1",
    provider: "anthropic",
    is_active: true,
    validated_at: "2026-01-01T00:00:00Z",
    validation_error: null,
    ...parcial,
  };
}

describe("escolherCredencialPadrao", () => {
  it("usa a chave da instalação quando ela existe", () => {
    expect(
      escolherCredencialPadrao({
        provider: "anthropic",
        instalacaoTemChave: true,
        credenciais: [cred({ id: "outra" })],
        tokenDaInstalacao: TOKEN,
      }),
    ).toBe(TOKEN);
  });

  it("usa a única chave validada do provedor", () => {
    expect(
      escolherCredencialPadrao({
        provider: "anthropic",
        instalacaoTemChave: false,
        credenciais: [cred({ id: "unica" }), cred({ id: "openai", provider: "openai" })],
        tokenDaInstalacao: TOKEN,
      }),
    ).toBe("unica");
  });

  it("não escolhe entre duas chaves válidas", () => {
    expect(
      escolherCredencialPadrao({
        provider: "anthropic",
        instalacaoTemChave: false,
        credenciais: [cred({ id: "a" }), cred({ id: "b" })],
        tokenDaInstalacao: TOKEN,
      }),
    ).toBe("");
  });

  it("ignora chave inválida ou de outro provedor", () => {
    expect(
      escolherCredencialPadrao({
        provider: "anthropic",
        instalacaoTemChave: false,
        credenciais: [cred({ validation_error: "recusada" })],
        tokenDaInstalacao: TOKEN,
      }),
    ).toBe("");
  });
});
