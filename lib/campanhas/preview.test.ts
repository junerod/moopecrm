import { describe, expect, it } from "vitest";

import { previewDaCampanha } from "@/lib/campanhas/preview";

describe("preview da campanha", () => {
  it("renderiza variável conhecida", () => {
    const r = previewDaCampanha({
      template: "Olá {{nome}}, sua proposta...",
      valores: { nome: "Maria" },
    });
    expect(r.ok).toBe(true);
    expect(r.texto).toBe("Olá Maria, sua proposta...");
  });

  it("bloqueia variável sem valor", () => {
    const r = previewDaCampanha({
      template: "Olá {{nome}}",
      valores: { nome: "" },
    });
    expect(r.ok).toBe(false);
    expect(r.faltando).toContain("nome");
  });

  it("rejeita variável desconhecida", () => {
    const r = previewDaCampanha({
      template: "Olá {{cpf}}",
      valores: { cpf: "000" },
    });
    expect(r.ok).toBe(false);
    expect(r.desconhecidas).toContain("cpf");
  });
});
