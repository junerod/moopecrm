import { describe, expect, it } from "vitest";

import { flowGraphSchema } from "@/lib/followup/graph-schema";
import { toReactFlow } from "@/lib/followup/graph-mappers";
import { montarModeloDeMenu, montarModeloPronto, opcoesPadrao } from "@/lib/followup/modelo-de-menu";
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

  it("escritório, loja e aviso nascem publicáveis", () => {
    for (const id of ["escritorio", "locadora", "loja", "aviso"] as const) {
      const grafo = montarModeloPronto(id, {
        origem: { x: 0, y: 0 },
        sufixo: id,
        incluirGatilho: true,
      });
      expect(flowGraphSchema.safeParse(grafo).success, id).toBe(true);
      const publicado = validateFlowForPublish(grafo);
      expect(publicado.ok, publicado.ok ? id : publicado.errors.map((e) => e.message).join("\n")).toBe(true);
    }
    const locadora = montarModeloPronto("locadora", {
      origem: { x: 0, y: 0 },
      sufixo: "loc",
      incluirGatilho: true,
    });
    const menu = locadora.nodes.find((n) => n.type === "menu");
    expect(menu?.type === "menu" ? menu.config.options.map((o) => o.label) : []).toContain("Outro WhatsApp");
    expect(locadora.nodes.some((n) => n.type === "assistente")).toBe(false);
    for (const id of ["escritorio", "loja", "locadora"] as const) {
      const g = montarModeloPronto(id, { origem: { x: 0, y: 0 }, sufixo: id, incluirGatilho: true });
      const outro = g.nodes.find((n) => n.label.includes("Outro WhatsApp"));
      expect(outro?.type, id).toBe("humano");
      expect(outro?.type === "humano" ? outro.config.team_note : "").toContain("não muda de WhatsApp");
      expect(g.nodes.some((n) => n.type === "assistente")).toBe(false);
    }
    const desenhado = toReactFlow(locadora);
    const saidas = desenhado.edges
      .filter((e) => e.source.endsWith("-menu"))
      .map((e) => e.sourceHandle);
    expect(saidas.sort()).toEqual(["else", "o1", "o2", "o3", "o4", "o5", "o6", "o7"]);
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
