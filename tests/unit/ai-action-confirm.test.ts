import { describe, expect, it } from "vitest";

import { confirmarPedidoDeAcao } from "@/lib/ai/acoes/confirmar";
import type { PedidoDeAcaoRow } from "@/lib/ai/acoes/pedidos";
import type { Queryable } from "@/lib/agent-engine/queue/queue";

function pedido(over: Partial<PedidoDeAcaoRow> = {}): PedidoDeAcaoRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    organization_id: "org",
    conversation_id: "conv",
    contact_id: null,
    lead_id: "lead",
    agent_id: null,
    requested_action: "move_lead_stage",
    payload: { lead_id: "lead", stage_id: "stage" },
    policy_result: "REQUIRE_CONFIRMATION",
    status: "pending",
    idempotency_key: "k1",
    confirmed_by: null,
    executed_by: null,
    result: null,
    ...over,
  };
}

describe("TESTE 8 e 9 — confirmação humana", () => {
  it("executa uma única vez; a segunda é idempotente", async () => {
    const estado = { atual: pedido() };
    let execucoes = 0;
    const db = {
      query: async (sql: string) => {
        if (sql.includes("from ai_action_requests") && sql.includes("id = $2")) {
          return { rows: [estado.atual] };
        }
        if (sql.includes("set status = 'executed'")) {
          estado.atual = {
            ...estado.atual,
            status: "executed",
            executed_by: "user-1",
            confirmed_by: "user-1",
            result: { lead_id: "lead", to_stage_id: "stage" },
          };
          return { rows: [estado.atual] };
        }
        return { rows: [] };
      },
    } as unknown as Queryable;

    const a = await confirmarPedidoDeAcao({
      db,
      organizationId: "org",
      pedidoId: estado.atual.id,
      userId: "user-1",
      aiMode: "controlled",
      executar: async () => {
        execucoes += 1;
        return { lead_id: "lead", to_stage_id: "stage" };
      },
    });
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.idempotent).toBe(false);
    expect(execucoes).toBe(1);

    const b = await confirmarPedidoDeAcao({
      db,
      organizationId: "org",
      pedidoId: estado.atual.id,
      userId: "user-1",
      aiMode: "controlled",
      executar: async () => {
        execucoes += 1;
        return { lead_id: "lead" };
      },
    });
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.idempotent).toBe(true);
    expect(execucoes).toBe(1);
  });
});
