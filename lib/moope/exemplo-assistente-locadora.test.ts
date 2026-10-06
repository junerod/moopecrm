import { describe, expect, it } from "vitest";

import { VALID_TOOL_IDS } from "@/lib/mcp/tools/catalogo";
import { TETO_TOOLS_POR_AGENTE } from "@/lib/mcp/tools/selecao-por-pacote";
import { TOOLS_IDS_OPERADOR_LOCADORA } from "@/lib/mcp/tools/locadora";
import { TOOLS_MOOPE_NO_WHATSAPP } from "@/lib/moope/agente-atendimento-locadora";

import {
  FERRAMENTAS_EXEMPLO_LOCADORA,
  FERRAMENTAS_OPERADOR_EXEMPLO_LOCADORA,
  PROMPT_EXEMPLO_LOCADORA,
  ehNomeDoExemploLocadora,
  ferramentasDoExemploEstaoPeladas,
  promptDoExemploEstaPelado,
} from "./exemplo-assistente-locadora";

describe("exemplo do assistente da locadora", () => {
  it("o texto de exemplo cabe na ficha e não inventa preço", () => {
    expect(PROMPT_EXEMPLO_LOCADORA.length).toBeGreaterThan(400);
    expect(PROMPT_EXEMPLO_LOCADORA.length).toBeLessThan(20000);
    expect(PROMPT_EXEMPLO_LOCADORA).toMatch(/NUNCA invente/);
    expect(PROMPT_EXEMPLO_LOCADORA).toMatch(/boleto/);
    expect(promptDoExemploEstaPelado(PROMPT_EXEMPLO_LOCADORA)).toBe(false);
    expect(promptDoExemploEstaPelado("Você é um atendente. Responda de forma educada e clara.")).toBe(true);
  });

  it("as ferramentas existem no catálogo e cabem no teto", () => {
    expect(FERRAMENTAS_EXEMPLO_LOCADORA.length).toBeLessThanOrEqual(TETO_TOOLS_POR_AGENTE);
    expect(FERRAMENTAS_OPERADOR_EXEMPLO_LOCADORA.length).toBeLessThanOrEqual(TETO_TOOLS_POR_AGENTE);
    for (const id of [...FERRAMENTAS_EXEMPLO_LOCADORA, ...FERRAMENTAS_OPERADOR_EXEMPLO_LOCADORA]) {
      expect(VALID_TOOL_IDS, id).toContain(id);
    }
    for (const id of TOOLS_MOOPE_NO_WHATSAPP) {
      expect(FERRAMENTAS_EXEMPLO_LOCADORA, id).toContain(id);
    }
    for (const id of FERRAMENTAS_OPERADOR_EXEMPLO_LOCADORA) {
      expect(TOOLS_IDS_OPERADOR_LOCADORA, id).toContain(id);
    }
  });

  it("reconhece os dois nomes que a locadora já usa", () => {
    expect(ehNomeDoExemploLocadora("Atendimento locadora")).toBe(true);
    expect(ehNomeDoExemploLocadora("Atendimento da Locadora")).toBe(true);
    expect(ehNomeDoExemploLocadora("Vendas")).toBe(false);
    expect(ferramentasDoExemploEstaoPeladas([])).toBe(true);
    expect(ferramentasDoExemploEstaoPeladas(["moope_listar_oferta"])).toBe(false);
  });
});
