/**
 * Follow-up de template no caminho dirigido por fluxo: sem LLM, com os
 * mesmos gates de envio (handoff, job invalidado, canal arquivado).
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

import type * as InboundTurnModule from "@/lib/agent-engine/agent/inbound-turn";
import type { JobRow } from "@/lib/agent-engine/queue/queue";

const runAgentTurn = vi.fn(async () => undefined);
const isLeadInHandoff = vi.fn(async (_pool?: unknown, _tenantId?: string, _leadId?: string) => false);

vi.mock("@/lib/agent-engine/agent/inbound-turn", async (original) => {
  const real = await original<typeof InboundTurnModule>();
  return { ...real, runAgentTurn };
});

vi.mock("@/lib/agent-engine/agent/human-handoff", () => ({
  isLeadInHandoff: (pool: unknown, tenantId: string, leadId: string) =>
    isLeadInHandoff(pool, tenantId, leadId),
}));

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TEMPLATE = "11111111-1111-4111-8111-111111111111";
const ENROLLMENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function jobTemplate(): JobRow {
  return {
    id: "job-1",
    organization_id: ORG,
    contact_id: LEAD,
    kind: "followup_turn",
    source_event_id: null,
    payload: {
      followup_enrollment_id: ENROLLMENT,
      node_id: "a1",
      purpose: "send_message",
      template_id: TEMPLATE,
      mode: "template",
    },
    status: "running",
    priority: 0,
    run_after: new Date(),
    attempts: 1,
    max_attempts: 3,
    last_error: null,
    locked_by: "w1",
    locked_at: new Date(),
    created_at: new Date(),
  } as JobRow;
}

function fakePool() {
  const query = vi.fn(async (sql: string) => {
    if (/from job_queue/.test(sql) && /last_error/.test(sql)) {
      return { rows: [{ last_error: null }] };
    }
    if (/from conversations/.test(sql)) {
      return {
        rows: [
          {
            id: "conversa-1",
            channel_session_id: "canal-1",
            channel_archived_at: null,
          },
        ],
      };
    }
    return { rows: [] };
  });
  return { pool: { query } as never };
}

let criarHandler: typeof import("@/lib/agent-engine/agent/followup-turn").createFollowupTurnHandler;

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

beforeAll(async () => {
  ({ createFollowupTurnHandler: criarHandler } = await import(
    "@/lib/agent-engine/agent/followup-turn"
  ));
}, 60_000);

describe("follow-up de template sem agente", () => {
  it("D/F. human takeover no caminho de template NÃO chama o modelo e NÃO envia", async () => {
    runAgentTurn.mockClear();
    isLeadInHandoff.mockResolvedValue(true);
    const complete = vi.fn(async () => undefined);
    const run = criarHandler({ completeFollowupTurn: complete, log } as never);
    const { pool } = fakePool();

    await run(jobTemplate(), pool, { workerId: "w1" });

    expect(runAgentTurn).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
  });

  it("J. canal arquivado continua dead-letter antes do turno, inclusive com template", async () => {
    runAgentTurn.mockClear();
    isLeadInHandoff.mockResolvedValue(false);
    const query = vi.fn(async (sql: string) => {
      if (/from job_queue/.test(sql)) return { rows: [{ last_error: null }] };
      if (/from conversations/.test(sql)) {
        return {
          rows: [
            {
              id: "conversa-1",
              channel_session_id: "canal-1",
              channel_archived_at: "2026-08-01T10:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    });
    const run = criarHandler({ log } as never);
    await expect(run(jobTemplate(), { query } as never, { workerId: "w1" })).rejects.toThrow(
      /canal arquivado/i,
    );
    expect(runAgentTurn).not.toHaveBeenCalled();
  });
});
