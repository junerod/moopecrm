import { describe, expect, it } from "vitest";

import { decidirArmacaoAutomatica, fluxoRequerIa } from "./fluxo-requer-ia";
import { grafoComIa, grafoDeterministico } from "./fluxo-fixtures";
import type { FlowGraph } from "./graph-schema";

const AGENT = "a0000000-0000-4000-8000-000000000001";

describe("fluxoRequerIa", () => {
  it("A. trigger + template + end não exige IA", () => {
    expect(fluxoRequerIa(grafoDeterministico())).toBe(false);
  });

  it("B. ai_classify exige IA", () => {
    expect(fluxoRequerIa(grafoComIa())).toBe(true);
  });

  it("B. action ai_message exige IA", () => {
    const g: FlowGraph = {
      nodes: [
        { id: "t1", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: {} },
        {
          id: "a1",
          type: "action",
          label: "IA",
          position: { x: 1, y: 0 },
          config: { mode: "ai_message", prompt_hint: "escreva um lembrete" },
        },
      ],
      edges: [],
    };
    expect(fluxoRequerIa(g)).toBe(true);
  });

  it("B. wait smart exige IA", () => {
    const g: FlowGraph = {
      nodes: [
        {
          id: "w1",
          type: "wait",
          label: "Espera",
          position: { x: 0, y: 0 },
          config: { mode: "smart", min_ms: 300_000, max_ms: 600_000 },
        },
      ],
      edges: [],
    };
    expect(fluxoRequerIa(g)).toBe(true);
  });
});

describe("decidirArmacaoAutomatica", () => {
  it("C. determinístico sem agente enrolla", () => {
    const r = decidirArmacaoAutomatica(grafoDeterministico(), null);
    expect(r.allowed).toBe(true);
    expect(r.agentId).toBeNull();
    expect(r.requiresAi).toBe(false);
  });

  it("B. fluxo com IA sem agente é recusado", () => {
    const r = decidirArmacaoAutomatica(grafoComIa(), null);
    expect(r.allowed).toBe(false);
    expect(r.requiresAi).toBe(true);
  });

  it("fluxo com IA com agente publicado passa e pina o agente", () => {
    const r = decidirArmacaoAutomatica(grafoComIa(), AGENT);
    expect(r.allowed).toBe(true);
    expect(r.agentId).toBe(AGENT);
  });

  it("L. a decisão não lê Ready Model id", () => {
    const src = decidirArmacaoAutomatica.toString() + fluxoRequerIa.toString();
    expect(src).not.toMatch(/locacao|advocacia|ready.model/i);
  });

  it("E. a decisão não lê ai_mode — COPILOT e OFF não mudam a semântica", () => {
    const src = decidirArmacaoAutomatica.toString() + fluxoRequerIa.toString();
    expect(src).not.toMatch(/ai_mode/);
    expect(decidirArmacaoAutomatica(grafoDeterministico(), null).allowed).toBe(true);
  });

  it("grafo ausente recusa", () => {
    expect(decidirArmacaoAutomatica(null, AGENT).allowed).toBe(false);
  });
});
