import { describe, expect, it } from "vitest";

import {
  PISO_DO_SEGREDO_DE_PROVISION,
  orfaParaReabrir,
  provisionSecretBate,
  slugDoTenantParceiro,
  urlDeLeituraDoProvision,
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

describe("urlDeLeituraDoProvision", () => {
  it("tira a página do painel e fica a origem", () => {
    expect(urlDeLeituraDoProvision("https://frotas.moope.com.br/dashboard")).toBe(
      "https://frotas.moope.com.br",
    );
  });

  it("guarda a API quando o caminho já é de serviço", () => {
    expect(urlDeLeituraDoProvision("https://finance-backend.moope.com.br")).toBe(
      "https://finance-backend.moope.com.br",
    );
  });
});

describe("orfaParaReabrir", () => {
  it("reabre a única locadora que ainda não tem id do parceiro", () => {
    expect(
      orfaParaReabrir([
        { organization_id: "abs", partner_tenant_id: null, status: "active" },
        { organization_id: "outra", partner_tenant_id: "9", status: "active" },
      ]),
    ).toBe("abs");
  });

  it("não escolhe quando há duas conexões manuais", () => {
    expect(
      orfaParaReabrir([
        { organization_id: "a", partner_tenant_id: null, status: "active" },
        { organization_id: "b", partner_tenant_id: "", status: "active" },
      ]),
    ).toBeNull();
  });
});
