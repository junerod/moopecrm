import { describe, expect, it } from "vitest";

import { buscarCapitulos, normalizarBusca } from "@/lib/manual/buscar";
import { CAPITULOS, capituloPorId } from "@/lib/manual/conteudo";

describe("manual do operador", () => {
  it("todo capítulo tem id único, número na ordem e pelo menos um bloco", () => {
    const ids = CAPITULOS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CAPITULOS.map((c) => c.numero)).toEqual(CAPITULOS.map((_, i) => i + 1));
    for (const c of CAPITULOS) {
      expect(c.titulo.length, c.id).toBeGreaterThan(2);
      expect(c.resumo.length, c.id).toBeGreaterThan(8);
      expect(c.blocos.length, c.id).toBeGreaterThan(0);
    }
  });

  it("a busca acha pelo vocabulário da tela, não só pelo título", () => {
    expect(buscarCapitulos(CAPITULOS, "whatsapp").map((c) => c.id)).toContain("whatsapp");
    expect(buscarCapitulos(CAPITULOS, "QR").map((c) => c.id)).toContain("whatsapp");
    expect(buscarCapitulos(CAPITULOS, "agente").map((c) => c.id)).toContain("agente");
    expect(buscarCapitulos(CAPITULOS, "automação").map((c) => c.id)).toContain("follow-up");
    expect(buscarCapitulos(CAPITULOS, "ASSUMIR").map((c) => c.id)).toContain("mensagens");
    expect(buscarCapitulos(CAPITULOS, "locadora").map((c) => c.id)).toContain("contatos-e-funis");
  });

  it("busca vazia devolve todos; termo inventado devolve nenhum", () => {
    expect(buscarCapitulos(CAPITULOS, "   ")).toHaveLength(CAPITULOS.length);
    expect(buscarCapitulos(CAPITULOS, "xyzzy-nao-existe")).toEqual([]);
  });

  it("acento não esconde o capítulo", () => {
    expect(normalizarBusca("Funil")).toBe(normalizarBusca("funíl"));
    expect(capituloPorId("follow-up")?.titulo).toMatch(/fluxo/i);
  });
});
