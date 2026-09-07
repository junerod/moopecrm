import type { FlowGraph } from "./graph-schema";

export const TEMPLATE_DE_TESTE = "11111111-1111-4111-8111-111111111111";

export function grafoDeterministico(): FlowGraph {
  return {
    nodes: [
      { id: "t1", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: {} },
      {
        id: "a1",
        type: "action",
        label: "Lembrete",
        position: { x: 220, y: 0 },
        config: { mode: "template", template_id: TEMPLATE_DE_TESTE },
      },
      { id: "e1", type: "end", label: "Fim", position: { x: 440, y: 0 }, config: { outcome: "converted" } },
    ],
    edges: [
      { id: "t1-a1", source: "t1", target: "a1", priority: 0, condition: { type: "always" } },
      { id: "a1-e1", source: "a1", target: "e1", priority: 0, condition: { type: "always" } },
    ],
  };
}

export function grafoComIa(): FlowGraph {
  return {
    nodes: [
      { id: "t1", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: {} },
      {
        id: "c1",
        type: "ai_classify",
        label: "Classifica",
        position: { x: 220, y: 0 },
        config: { classes: ["quente", "frio"], grace_timeout_ms: 900_000, target: "last_reply" },
      },
      { id: "e1", type: "end", label: "Fim", position: { x: 440, y: 0 }, config: { outcome: "converted" } },
    ],
    edges: [
      { id: "t1-c1", source: "t1", target: "c1", priority: 0, condition: { type: "always" } },
      { id: "c1-e1", source: "c1", target: "e1", priority: 0, condition: { type: "always" } },
    ],
  };
}
