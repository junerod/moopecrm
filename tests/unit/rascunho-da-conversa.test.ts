import { describe, expect, it } from "vitest";

import {
  chaveDoRascunho,
  gravarRascunho,
  lerRascunho,
} from "@/lib/inbox/rascunho-da-conversa";
import { tituloDaRespostaRapida } from "@/lib/inbox/titulo-da-resposta-rapida";
import { deveAgendarLeitura } from "@/lib/inbox/agendar-leitura";

describe("rascunho da conversa", () => {
  it("grava por conversa e não mistura com a outra", () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => {
        mem.set(k, v);
      },
      removeItem: (k: string) => {
        mem.delete(k);
      },
    };
    gravarRascunho(storage, "a", "oi Maria");
    gravarRascunho(storage, "b", "oi João");
    expect(lerRascunho(storage, "a")).toBe("oi Maria");
    expect(lerRascunho(storage, "b")).toBe("oi João");
    gravarRascunho(storage, "a", "");
    expect(lerRascunho(storage, "a")).toBe("");
    expect(mem.has(chaveDoRascunho("a"))).toBe(false);
    expect(lerRascunho(storage, "b")).toBe("oi João");
  });
});

describe("tituloDaRespostaRapida", () => {
  it("usa a primeira linha, corta no limite, e vazio vira nome genérico", () => {
    expect(tituloDaRespostaRapida("  Bom dia!\nObrigada")).toBe("Bom dia!");
    expect(tituloDaRespostaRapida("")).toBe("Resposta rápida");
    const longo = "x".repeat(80);
    expect(tituloDaRespostaRapida(longo)).toBe(`${"x".repeat(57)}…`);
  });
});

describe("deveAgendarLeitura", () => {
  it("não marca lida se a pessoa pediu não-lida", () => {
    expect(deveAgendarLeitura(3, false)).toBe(true);
    expect(deveAgendarLeitura(3, true)).toBe(false);
    expect(deveAgendarLeitura(0, false)).toBe(false);
  });
});
