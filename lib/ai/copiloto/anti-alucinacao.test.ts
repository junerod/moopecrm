import { describe, expect, it } from "vitest";

import {
  deveRecusarInventar,
  perguntaPedeDadoCritico,
  RASCUNHO_SEM_FONTE,
} from "./anti-alucinacao";

describe("anti-alucinação do Copilot", () => {
  it("reconhece pergunta de preço", () => {
    expect(perguntaPedeDadoCritico("Quanto custa o Produto Zeta?")).toBe(true);
  });

  it("recusa inventar quando não há trecho", () => {
    expect(deveRecusarInventar("Quanto custa o Produto Zeta?", 0)).toBe(true);
    expect(RASCUNHO_SEM_FONTE).toMatch(/não tenho esse dado/i);
  });

  it("não recusa quando o acervo trouxe trecho", () => {
    expect(deveRecusarInventar("Quanto custa o Produto Zeta?", 1)).toBe(false);
  });

  it("pergunta comum sem dado crítico não recusa", () => {
    expect(deveRecusarInventar("Bom dia, vocês abrem sábado?", 0)).toBe(false);
  });
});
