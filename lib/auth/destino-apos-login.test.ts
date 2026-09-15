import { describe, expect, it } from "vitest";

import { destinoAposLogin } from "./destino-apos-login";

describe("destinoAposLogin", () => {
  it("comercial com empresa — entra no app", () => {
    expect(
      destinoAposLogin({ isPlatformAdmin: false, temOrganizacao: true }),
    ).toBe("/app/inbox");
  });

  it("admin da instalação sem empresa — vai para o admin, não para o CRM vazio", () => {
    expect(
      destinoAposLogin({ isPlatformAdmin: true, temOrganizacao: false }),
    ).toBe("/admin/dashboard");
  });

  it("next da entrada do app não segura o admin sem empresa no inbox", () => {
    expect(
      destinoAposLogin({
        next: "/app/inbox",
        isPlatformAdmin: true,
        temOrganizacao: false,
      }),
    ).toBe("/admin/dashboard");
  });

  it("deep link de plataforma continua valendo", () => {
    expect(
      destinoAposLogin({
        next: "/app/settings/atualizacao",
        isPlatformAdmin: true,
        temOrganizacao: false,
      }),
    ).toBe("/app/settings/atualizacao");
  });

  it("next externo é descartado", () => {
    expect(
      destinoAposLogin({
        next: "https://evil.example",
        isPlatformAdmin: false,
        temOrganizacao: true,
      }),
    ).toBe("/app/inbox");
  });
});
