import { describe, expect, it } from "vitest";

import { agregarMetricas, aplicarDesfecho, desfechoDosLeads } from "./metricas";

describe("desfechoDosLeads", () => {
  it("conta ganho, perda e soma só o valor dos ganhos", () => {
    const d = desfechoDosLeads([
      { status: "won", value_cents: 1890000 },
      { status: "won", value_cents: null },
      { status: "lost", value_cents: 500000 },
      { status: "open", value_cents: 100000 },
    ]);
    expect(d.ganhos).toBe(2);
    expect(d.perdidos).toBe(1);
    expect(d.valor_ganho_cents).toBe(1890000);
  });

  it("mistura no resumo da campanha sem apagar envio e resposta", () => {
    const m = aplicarDesfecho(agregarMetricas([{ status: "replied", lead_id: "l1" }]), {
      ganhos: 1,
      perdidos: 0,
      valor_ganho_cents: 25000,
    });
    expect(m.respondidas).toBe(1);
    expect(m.leads_associados).toBe(1);
    expect(m.ganhos).toBe(1);
    expect(m.valor_ganho_cents).toBe(25000);
  });
});
