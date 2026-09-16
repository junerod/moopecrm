import { describe, expect, it } from "vitest";

import { destinoDoAppPessoal, HREF_DO_APP_PESSOAL, HREF_SEM_EMPRESA } from "./saida-da-plataforma";

describe("destinoDoAppPessoal", () => {
  it("com empresa — vai ao Início, não devolve ao admin", () => {
    expect(destinoDoAppPessoal(true)).toBe(HREF_DO_APP_PESSOAL);
    expect(destinoDoAppPessoal(true)).not.toMatch(/^\/admin\/dashboard/);
  });

  it("sem empresa — tela de saída com logout, não o dashboard", () => {
    expect(destinoDoAppPessoal(false)).toBe(HREF_SEM_EMPRESA);
    expect(destinoDoAppPessoal(false)).not.toBe("/admin/dashboard");
  });
});
