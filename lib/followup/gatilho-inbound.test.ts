import { describe, expect, it } from "vitest";

import { aplicaGatilhoInbound, EVENTO_INBOUND, type GatilhoInboundDb } from "./gatilho-inbound";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { grafoBotRecepcao } from "@/lib/business-packs/bot-semente";

function row(over: Partial<EventRow> = {}): EventRow {
  return {
    id: "evt-1",
    organization_id: "org-1",
    event_type: EVENTO_INBOUND,
    payload: { conversation_id: "conv-1", contact_id: "ct-1" },
    created_at: new Date().toISOString(),
    ...over,
  } as EventRow;
}

describe("aplicaGatilhoInbound", () => {
  it("enrolla pointer bot inbound e ignora o que não é bot", async () => {
    const inserts: unknown[] = [];
    const db: GatilhoInboundDb = {
      async carregaPointersDeInbound() {
        return [{ id: "ptr-bot", organization_id: "org-1", active_version_id: "ver-1" }];
      },
      async carregaContatoDaConversa() {
        return "ct-1";
      },
      async carregaFluxoPublicado() {
        return { triggerNodeId: "t1", graph: grafoBotRecepcao() };
      },
      async insereEnrollment(input) {
        inserts.push(input);
        return { inserted: true, id: "enr-1" };
      },
      async insereEventoDoEnrollment() {},
    };
    const s = await aplicaGatilhoInbound({ db, clock: () => new Date() }, row());
    expect(s.matched).toBe(true);
    expect(s.enrolled).toBe(1);
    expect(inserts).toHaveLength(1);
  });

  it("evento velho não enrolla", async () => {
    const db: GatilhoInboundDb = {
      async carregaPointersDeInbound() {
        return [{ id: "ptr-bot", organization_id: "org-1", active_version_id: "ver-1" }];
      },
      async carregaContatoDaConversa() {
        return "ct-1";
      },
      async carregaFluxoPublicado() {
        return { triggerNodeId: "t1", graph: grafoBotRecepcao() };
      },
      async insereEnrollment() {
        throw new Error("não deveria insertar");
      },
      async insereEventoDoEnrollment() {},
    };
    const s = await aplicaGatilhoInbound(
      { db, clock: () => new Date("2026-09-16T12:00:00Z") },
      row({ created_at: "2026-09-15T10:00:00Z" }),
    );
    expect(s.vencidos).toBe(1);
    expect(s.enrolled).toBe(0);
  });
});
