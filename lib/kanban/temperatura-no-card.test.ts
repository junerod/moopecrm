import { describe, expect, it } from "vitest";

import { buildCardInput } from "./card-state";
import type { Lead } from "@/lib/types/leads";

function lead(over: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    organization_id: "org",
    pipeline_id: "p1",
    stage_id: "s1",
    contact_id: "c1",
    title: "Lead de prova",
    description: null,
    value_cents: null,
    currency: "BRL",
    status: "open",
    lost_reason: null,
    position_in_stage: 1,
    owner_kind: "user",
    owner_user_id: "u1",
    owner_agent_id: null,
    assigned_at: null,
    last_activity_at: "2026-07-25T10:00:00Z",
    created_at: "2026-07-20T10:00:00Z",
    updated_at: "2026-07-25T10:00:00Z",
    tags: [],
    custom_fields: {},
    temperatura: "quente",
    ...over,
  } as Lead;
}

describe("temperatura no card do Kanban", () => {
  it("reusa crm_leads.temperatura — não cria outro campo", () => {
    const card = buildCardInput(lead(), {
      stageName: "Proposta",
      ownerNames: new Map(),
    });
    expect(card.temperatura).toBe("quente");
  });

  it("ausência é ausência", () => {
    const card = buildCardInput(lead({ temperatura: null }), {
      stageName: "Proposta",
      ownerNames: new Map(),
    });
    expect(card.temperatura).toBeNull();
  });
});
