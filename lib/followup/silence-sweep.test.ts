import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { EnabledFollowupAgent, FollowupGateDb } from "./agent-followup-gate";
import { grafoComIa, grafoDeterministico } from "./fluxo-fixtures";
import type { FlowGraph } from "./graph-schema";
import {
  runSilenceSweep,
  type SilencePointer,
  type SilenceSweepDb,
} from "./silence-sweep";

const ORG = "11111111-1111-4111-8111-111111111111";
const POINTER = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";
const CONTATO = "44444444-4444-4444-8444-444444444444";
const AGENT = "55555555-5555-4555-8555-555555555555";
const CLOCK = () => new Date("2026-09-07T12:00:00.000Z");

function pointer(over: Partial<SilencePointer> = {}): SilencePointer {
  return {
    id: POINTER,
    organization_id: ORG,
    active_version_id: VERSION,
    threshold_minutes: 1440,
    segments: [],
    ...over,
  };
}

function fakeGate(agentes: EnabledFollowupAgent[]): FollowupGateDb {
  return {
    async loadEnabledPublishedFollowupAgents() {
      return agentes;
    },
  };
}

function fakeDb(opts: {
  pointers?: SilencePointer[];
  contacts?: string[];
  graph?: FlowGraph | null;
  enrollments: Array<Record<string, unknown>>;
}): SilenceSweepDb {
  return {
    async loadActiveSilencePointers() {
      return opts.pointers ?? [pointer()];
    },
    async loadSilentContactIds() {
      return opts.contacts ?? [CONTATO];
    },
    async loadPublishedFlow() {
      if (opts.graph === null) return null;
      const graph = opts.graph ?? grafoDeterministico();
      return { triggerNodeId: "t1", graph };
    },
    async insertEnrollment(input) {
      opts.enrollments.push(input);
      return { inserted: true };
    },
  };
}

describe("runSilenceSweep — classificação do grafo", () => {
  it("A/C. fluxo determinístico sem agente enrolla com agent_id null", async () => {
    const enrollments: Array<Record<string, unknown>> = [];
    const s = await runSilenceSweep({
      db: fakeDb({ enrollments }),
      gateDb: fakeGate([]),
      clock: CLOCK,
    });
    expect(s.pointers_gated_out).toBe(0);
    expect(s.enrolled).toBe(1);
    expect(enrollments[0]?.agent_id).toBeNull();
  });

  it("B. fluxo com IA sem agente é gated out", async () => {
    const enrollments: Array<Record<string, unknown>> = [];
    const s = await runSilenceSweep({
      db: fakeDb({ graph: grafoComIa(), enrollments }),
      gateDb: fakeGate([]),
      clock: CLOCK,
    });
    expect(s.pointers_gated_out).toBe(1);
    expect(s.enrolled).toBe(0);
    expect(enrollments).toHaveLength(0);
  });

  it("fluxo com IA e agente publicado enrolla pinando o agente", async () => {
    const enrollments: Array<Record<string, unknown>> = [];
    const s = await runSilenceSweep({
      db: fakeDb({ graph: grafoComIa(), enrollments }),
      gateDb: fakeGate([{ agentId: AGENT, pointerIds: [POINTER] }]),
      clock: CLOCK,
    });
    expect(s.enrolled).toBe(1);
    expect(enrollments[0]?.agent_id).toBe(AGENT);
  });

  it("E/L. o sweep não lê ai_mode nem id de Ready Model", () => {
    const src = readFileSync("lib/followup/silence-sweep.ts", "utf8");
    expect(src).not.toMatch(/ai_mode/);
    expect(src).not.toMatch(/locacao|advocacia|readyModel/);
  });
});
