import { describe, expect, it } from "vitest";

import { textoDoAvisoWhatsappCaiu } from "@/lib/assessor/avisar";

describe("aviso de WhatsApp caído", () => {
  it("diz qual conexão caiu e o que fazer", () => {
    const texto = textoDoAvisoWhatsappCaiu({
      apelido: "Vendas",
      status: "FAILED",
      organization: "Locadora",
    });
    expect(texto).toMatch(/WhatsApp do CRM caiu/);
    expect(texto).toContain("Locadora");
    expect(texto).toContain("Vendas");
    expect(texto).toContain("FAILED");
    expect(texto).toMatch(/Conexões/);
  });
});
