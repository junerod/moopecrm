import { describe, expect, it } from "vitest";

import { flowGraphSchema } from "@/lib/followup/graph-schema";
import { montarModeloDeMenu, opcoesPadrao } from "@/lib/followup/modelo-de-menu";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";

describe("montarModeloDeMenu", () => {
  it("nasce publicável: gatilho, menu 1 2 3 e cada saída ligada", () => {
    const grafo = montarModeloDeMenu({
      titulo: "Recepção",
      opcoes: opcoesPadrao(3),
      origem: { x: 0, y: 0 },
      sufixo: "t1",
      incluirGatilho: true,
    });
    expect(flowGraphSchema.safeParse(grafo).success).toBe(true);
    const publicado = validateFlowForPublish(grafo);
    expect(publicado.ok, publicado.ok ? "" : publicado.errors.map((e) => e.message).join("\n")).toBe(true);
    const menu = grafo.nodes.find((n) => n.type === "menu");
    expect(menu?.type === "menu" ? menu.config.options.map((o) => o.number) : []).toEqual([1, 2, 3]);
    expect(grafo.nodes.some((n) => n.type === "faq" && n.label.startsWith("Resposta"))).toBe(true);
    expect(grafo.nodes.some((n) => n.type === "humano")).toBe(true);
    expect(grafo.nodes.some((n) => n.type === "assistente")).toBe(true);
  });

  it("sem gatilho ainda liga o senão e a resposta no fim", () => {
    const grafo = montarModeloDeMenu({
      titulo: "Menu",
      opcoes: opcoesPadrao(2),
      origem: { x: 10, y: 10 },
      sufixo: "t2",
      incluirGatilho: false,
    });
    expect(grafo.nodes.some((n) => n.type === "trigger")).toBe(false);
    expect(grafo.edges.some((e) => e.condition.type === "always" && e.target.endsWith("-senao"))).toBe(true);
  });
});
