import { describe, expect, it } from "vitest";

import {
  agregarMetricas,
  aplicarDesfecho,
  compararDuasCampanhas,
  desfechoDosLeads,
  desfechoPorLeadIds,
} from "./metricas";

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

describe("compararDuasCampanhas", () => {
  it("mostra quem vendeu mais, não só quem disparou mais", () => {
    const a = aplicarDesfecho(agregarMetricas([{ status: "replied", lead_id: "l1" }]), {
      ganhos: 1,
      perdidos: 3,
      valor_ganho_cents: 640000,
    });
    const b = aplicarDesfecho(agregarMetricas([{ status: "replied", lead_id: "l2" }]), {
      ganhos: 4,
      perdidos: 1,
      valor_ganho_cents: 1890000,
    });
    const linhas = compararDuasCampanhas(a, b);
    const receita = linhas.find((l) => l.chave === "receita");
    const ganhos = linhas.find((l) => l.chave === "ganhos");
    expect(receita?.delta).toBe(640000 - 1890000);
    expect(ganhos).toMatchObject({ a: 1, b: 4, delta: -3 });
  });

  it("desfechoPorLeadIds só olha os leads daquela campanha", () => {
    const d = desfechoPorLeadIds(
      ["l1"],
      [
        { id: "l1", status: "won", value_cents: 100 },
        { id: "l2", status: "won", value_cents: 999 },
      ],
    );
    expect(d).toEqual({ ganhos: 1, perdidos: 0, valor_ganho_cents: 100 });
  });
});
