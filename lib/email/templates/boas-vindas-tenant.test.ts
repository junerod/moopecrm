import { describe, expect, it } from "vitest";

import { buildBoasVindasDoTenant } from "@/lib/email/templates/boas-vindas-tenant";

const MARCA = {
  nome: "MOOPE CRM",
  accent: "#111111",
  accentFg: "#ffffff",
  logoUrl: null,
};

describe("boas-vindas do tenant", () => {
  it("com senha inicial, o texto leva a senha e o login — não um produto inventado", () => {
    const { subject, html, text } = buildBoasVindasDoTenant({
      orgName: "Locadora Norte",
      loginUrl: "https://crm.exemplo.com/login",
      senha: "segredo-8",
      marca: MARCA,
    });
    expect(subject).toContain("Locadora Norte");
    expect(text).toContain("segredo-8");
    expect(html).toContain("Senha inicial");
    expect(html).toContain("MOOPE CRM");
  });

  it("sem senha, o botão é criar senha — não entrar", () => {
    const { html, text } = buildBoasVindasDoTenant({
      orgName: "Escritório Sul",
      loginUrl: "https://crm.exemplo.com/login",
      definirSenhaUrl: "https://crm.exemplo.com/auth/confirm?type=recovery",
      marca: MARCA,
    });
    expect(html).toContain("Criar sua senha");
    expect(text).toContain("Criar sua senha");
    expect(html).not.toContain("Senha inicial");
  });
});
