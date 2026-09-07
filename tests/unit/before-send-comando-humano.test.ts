/**
 * ETAPA 1 — o gate de comando e a releitura no último instante.
 *
 * A corrida que estes casos existem para impedir: a IA começa a gerar, o
 * humano assume (ou envia), a IA chega no ChannelAdapter e a mensagem sai.
 * A 1ª leitura no começo do turno NÃO basta. O runner relê sob o lock e,
 * de novo, imediatamente antes de `send()`.
 */
import type pg from "pg";
import { describe, expect, it, vi } from "vitest";

import {
  conversationControlGate,
  runBeforeSend,
  type Gate,
  type GateContext,
} from "@/lib/agent-engine/guardrails/before-send";
import { decidirEnvioConversacional } from "@/lib/inbox/comando-da-conversa";
import type { Logger } from "@/lib/agent-engine/obs/logger";

const ORG = "00000000-0000-4000-8000-000000000001";
const LEAD = "00000000-0000-4000-8000-000000000002";
const JOB = "00000000-0000-4000-8000-000000000003";
const SESSION = "00000000-0000-4000-8000-000000000004";
const CONV = "00000000-0000-4000-8000-000000000005";
const USER = "00000000-0000-4000-8000-000000000006";
const AGORA = new Date("2026-09-07T12:00:00.000Z");

const log: Logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function linha(over: {
  status?: string;
  assigned_to_user_id?: string | null;
  assignee_kind?: string | null;
  bot_silenced_until?: string | null;
  force_human?: boolean;
  is_blocked?: boolean;
} = {}) {
  return {
    status: over.status ?? "open",
    assigned_to_user_id: over.assigned_to_user_id ?? null,
    assignee_kind: over.assignee_kind ?? null,
    bot_silenced_until: over.bot_silenced_until ?? null,
    force_human: over.force_human ?? false,
    is_blocked: over.is_blocked ?? false,
  };
}

function poolComComando(linhas: Array<ReturnType<typeof linha>>) {
  let lidas = 0;
  const client = {
    query: vi.fn(async (sql: string) => {
      const q = String(sql);
      if (q.includes("comando-da-conversa")) {
        const row = linhas[Math.min(lidas, linhas.length - 1)];
        lidas += 1;
        return { rows: row ? [row] : [] };
      }
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = {
    connect: vi.fn().mockResolvedValue(client),
    query: vi.fn().mockResolvedValue({ rows: [{ id: "trace-1" }] }),
  } as unknown as pg.Pool;
  return { pool, client, lidas: () => lidas };
}

const throttle: Gate = {
  name: "pacing",
  evaluate: () => ({ pass: true, waitMs: 25 }),
};

async function roda(
  linhas: Array<ReturnType<typeof linha>>,
  extras: { sleep?: () => Promise<void> } = {},
) {
  const { pool, lidas } = poolComComando(linhas);
  const send = vi.fn(async () => ({ kind: "sent" as const, idempotencyKey: "k", messageId: "m" }));
  const result = await runBeforeSend({
    pool,
    log,
    tenantId: ORG,
    leadId: LEAD,
    jobId: JOB,
    conversationId: CONV,
    channelSessionId: SESSION,
    body: "oi, ainda estou gerando",
    optedOutThisTurn: false,
    crmDailyLimit: null,
    now: AGORA,
    gates: [conversationControlGate, throttle],
    send,
    ...(extras.sleep ? { sleep: extras.sleep } : { sleep: async () => undefined }),
  });
  return { result, send, lidas };
}

describe("conversationControlGate — predicado isolado", () => {
  function ctx(decisao: GateContext["conversationControl"]): GateContext {
    return { conversationControl: decisao } as GateContext;
  }

  it("sem decisão no ctx = passa (testes parciais não cala)", () => {
    expect(conversationControlGate.evaluate(ctx(undefined)).pass).toBe(true);
  });

  it("permitido = passa", () => {
    expect(conversationControlGate.evaluate(ctx({ permitido: true })).pass).toBe(true);
  });

  it("TESTE G: CLOSED → DENY_CLOSED", () => {
    const d = decidirEnvioConversacional({ status: "closed", assigned_to_user_id: null });
    const v = conversationControlGate.evaluate(ctx(d));
    expect(v.pass).toBe(false);
    if (v.pass) throw new Error("inalcançável");
    expect(v.code).toBe("DENY_CLOSED");
  });

  it("TESTE H: BLOCKED → DENY_BLOCKED", () => {
    const d = decidirEnvioConversacional({
      status: "open",
      assigned_to_user_id: null,
      is_blocked: true,
    });
    const v = conversationControlGate.evaluate(ctx(d));
    expect(v.pass).toBe(false);
    if (v.pass) throw new Error("inalcançável");
    expect(v.code).toBe("DENY_BLOCKED");
  });
});

describe("runBeforeSend — humano no comando", () => {
  it("TESTE A: humano assumiu; IA tenta enviar → CANCELADO", async () => {
    const { result, send } = await roda([
      linha({
        status: "claimed",
        assigned_to_user_id: USER,
        assignee_kind: "user",
        bot_silenced_until: "infinity",
      }),
    ]);
    expect(result.status).toBe("vetoed");
    if (result.status !== "vetoed") throw new Error("inalcançável");
    expect(result.gate).toBe("conversation_control");
    expect(result.code).toBe("DENY_HUMAN_ACTIVE");
    expect(send).not.toHaveBeenCalled();
  });

  it("TESTE B: IA gerou; humano assume durante o throttle; releitura CANCELA", async () => {
    // Primeira leitura (cadeia) = automático livre. Segunda (pós-throttle) = humano.
    const { result, send, lidas } = await roda(
      [
        linha({ status: "open" }),
        linha({
          status: "claimed",
          assigned_to_user_id: USER,
          assignee_kind: "user",
          bot_silenced_until: "infinity",
        }),
      ],
      { sleep: async () => undefined },
    );
    expect(lidas()).toBeGreaterThanOrEqual(2);
    expect(result.status).toBe("vetoed");
    if (result.status !== "vetoed") throw new Error("inalcançável");
    expect(result.gate).toBe("conversation_control");
    expect(result.code).toBe("DENY_HUMAN_ACTIVE");
    expect(send).not.toHaveBeenCalled();
  });

  it("TESTE G: conversa CLOSED → DENY", async () => {
    const { result, send } = await roda([linha({ status: "closed" })]);
    expect(result.status).toBe("vetoed");
    if (result.status !== "vetoed") throw new Error("inalcançável");
    expect(result.code).toBe("DENY_CLOSED");
    expect(send).not.toHaveBeenCalled();
  });

  it("TESTE H: contato BLOCKED → DENY", async () => {
    const { result, send } = await roda([linha({ is_blocked: true })]);
    expect(result.status).toBe("vetoed");
    if (result.status !== "vetoed") throw new Error("inalcançável");
    expect(result.code).toBe("DENY_BLOCKED");
    expect(send).not.toHaveBeenCalled();
  });

  it("sem linha no banco = fail-open (não cala o envio por ausência)", async () => {
    const { result, send } = await roda([]);
    expect(result.status).toBe("sent");
    expect(send).toHaveBeenCalledOnce();
  });
});
