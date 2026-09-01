import { describe, expect, it } from "vitest";

import {
  PISO_DO_SEGREDO_DE_PROVISION,
  provisionSecretBate,
  slugDoTenantParceiro,
} from "@/lib/moope/provisionar";

describe("slugDoTenantParceiro", () => {
  it("tenant 9 vira loc-9", () => {
    expect(slugDoTenantParceiro("9")).toBe("loc-9");
  });

  it("não aceita lixo no id", () => {
    expect(slugDoTenantParceiro("9; drop")).toBe("loc-9drop");
    expect(slugDoTenantParceiro("")).toBe("loc-x");
  });
});

describe("provisionSecretBate", () => {
  const ok = "x".repeat(PISO_DO_SEGREDO_DE_PROVISION);

  it("recusa vazio, curto ou diferente", () => {
    expect(provisionSecretBate(ok, "")).toBe(false);
    expect(provisionSecretBate(ok, "curto")).toBe(false);
    expect(provisionSecretBate("outra-coisa-grande", ok)).toBe(false);
    expect(provisionSecretBate(null, ok)).toBe(false);
  });

  it("aceita o mesmo valor com tamanho de piso", () => {
    expect(provisionSecretBate(ok, ok)).toBe(true);
  });
});
