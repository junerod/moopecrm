import { describe, expect, it } from "vitest";

import { anexarAcoesAosLeads } from "./anexar-ao-board";
import type { Lead } from "@/lib/types/leads";

function lead(parcial: Partial<Lead>): Lead {
  return {
    id: parcial.id ?? "l1",
    organization_id: "o1",
    pipeline_id: "p1",
    stage_id: "s1",
    contact_id: "c1",
    title: "Maria",
    description: null,
    status: "open",
    lost_reason: null,
    position_in_stage: 1,
    value_cents: 320000,
    currency: "BRL",
    owner_user_id: "u1",
    owner_kind: "user",
    owner_agent_id: null,
    assigned_at: null,
    last_activity_at: null,
    expected_close_date: null,
    closed_at: null,
    source: "whatsapp",
    source_metadata: {},
    external_id: null,
    custom_fields: {},
    tags: [],
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    created_by_user_id: null,
    ...parcial,
  };
}

describe("anexar próxima ação canônica ao board", () => {
  it("casa por lead_id quando a demanda aponta o negócio", () => {
    const [anexado] = anexarAcoesAosLeads(
      [lead({ id: "l1", contact_id: "c1" })],
      [
        {
          id: "d1",
          lead_id: "l1",
          contact_id: "c1",
          proximo_passo: "Retornar proposta",
          proximo_passo_em: "2026-09-12T18:00:00.000Z",
          dono_user_id: "u1",
        },
      ],
    );
    expect(anexado?.proxima_acao?.texto).toBe("Retornar proposta");
    expect(anexado?.proxima_acao?.demanda_id).toBe("d1");
  });

  it("cai no contato só quando a demanda não tem lead_id", () => {
    const [anexado] = anexarAcoesAosLeads(
      [lead({ id: "l1", contact_id: "c1" })],
      [
        {
          id: "d2",
          lead_id: null,
          contact_id: "c1",
          proximo_passo: "Ligar",
          proximo_passo_em: null,
          dono_user_id: "u1",
        },
      ],
    );
    expect(anexado?.proxima_acao?.texto).toBe("Ligar");
  });

  it("não cola demanda de outro lead no card só porque o contato coincide", () => {
    const [anexado] = anexarAcoesAosLeads(
      [lead({ id: "l1", contact_id: "c1" })],
      [
        {
          id: "d3",
          lead_id: "outro",
          contact_id: "c1",
          proximo_passo: "De outro negócio",
          proximo_passo_em: null,
          dono_user_id: "u1",
        },
      ],
    );
    expect(anexado?.proxima_acao).toBeNull();
  });
});
