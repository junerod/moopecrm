import { describe, expect, it } from "vitest";

import { resolverNegocioAberto, type LeadFicha } from "./crm-summary-tipos";

function lead(parcial: Partial<LeadFicha> & { id: string; status: string }): LeadFicha {
  return {
    title: parcial.title ?? parcial.id,
    value_cents: null,
    currency: "BRL",
    updated_at: "2026-09-10T00:00:00Z",
    last_activity_at: null,
    source: "whatsapp",
    pipeline: null,
    stage: null,
    owner: { user_id: null, agent_id: null, display_name: null },
    ...parcial,
  };
}

describe("resolverNegocioAberto", () => {
  it("zero OPEN → adicionar ao funil", () => {
    expect(resolverNegocioAberto([lead({ id: "l1", status: "won" })])).toEqual({
      resolucao: "nenhum",
      lead_id: null,
      leads_abertos: [],
    });
  });

  it("um OPEN → opera esse", () => {
    const aberto = lead({ id: "l2", status: "open" });
    expect(resolverNegocioAberto([aberto, lead({ id: "l1", status: "lost" })])).toEqual({
      resolucao: "unico",
      lead_id: "l2",
      leads_abertos: [aberto],
    });
  });

  it("dois OPEN → NÃO escolhe", () => {
    const a = lead({ id: "a", status: "open" });
    const b = lead({ id: "b", status: "open" });
    expect(resolverNegocioAberto([a, b])).toEqual({
      resolucao: "varios",
      lead_id: null,
      leads_abertos: [a, b],
    });
  });
});
