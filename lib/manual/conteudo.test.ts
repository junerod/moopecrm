import { describe, expect, it } from "vitest";

import { buscarCapitulos, normalizarBusca, textoDoBloco } from "@/lib/manual/buscar";
import { CAPITULOS, capituloPorId } from "@/lib/manual/conteudo";
import { visualDoCapitulo } from "@/lib/manual/visual";

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
    expect(buscarCapitulos(CAPITULOS, "locadora").map((c) => c.id)).toEqual(
      expect.arrayContaining(["contatos-e-funis", "locadora"]),
    );
    expect(buscarCapitulos(CAPITULOS, "campanha").map((c) => c.id)).toContain("campanhas");
    expect(buscarCapitulos(CAPITULOS, "aluguel").map((c) => c.id)).toContain("locadora");
    expect(buscarCapitulos(CAPITULOS, "modelos prontos").map((c) => c.id)).toContain("modelos-prontos");
    expect(buscarCapitulos(CAPITULOS, "meu modelo").map((c) => c.id)).toContain("modelos-prontos");
    expect(buscarCapitulos(CAPITULOS, "honorário").map((c) => c.id)).toContain("advocacia");
    expect(buscarCapitulos(CAPITULOS, "clínica").map((c) => c.id)).toContain("outros-modelos");
    expect(buscarCapitulos(CAPITULOS, "conhecimento").map((c) => c.id)).toContain("conhecimento");
  });

  it("busca vazia devolve todos; termo inventado devolve nenhum", () => {
    expect(buscarCapitulos(CAPITULOS, "   ")).toHaveLength(CAPITULOS.length);
    expect(buscarCapitulos(CAPITULOS, "xyzzy-nao-existe")).toEqual([]);
  });

  it("acento não esconde o capítulo", () => {
    expect(normalizarBusca("Funil")).toBe(normalizarBusca("funíl"));
    expect(capituloPorId("follow-up")?.titulo).toMatch(/fluxo/i);
  });

  it("todo capítulo tem ícone e cor próprios, não o fallback", () => {
    for (const c of CAPITULOS) {
      const v = visualDoCapitulo(c.id);
      expect(v.grupo, c.id).not.toBe("");
      expect(v.icone.displayName ?? v.icone.name, c.id).toBeTruthy();
    }
    expect(textoDoBloco({ tipo: "atalho", titulo: "Loja", href: "/app/modelos-prontos", cta: "Abrir" })).toMatch(
      /modelos-prontos/,
    );
  });
});
