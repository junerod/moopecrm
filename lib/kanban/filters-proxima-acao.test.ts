import { describe, expect, it } from "vitest";

import { applyFilters, filtersFromParams, filtersToParams, type LeadFilters } from "./filters";
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

describe("filtros comerciais da próxima ação", () => {
  const atrasada = lead({
    id: "atrasada",
    proxima_acao: {
      demanda_id: "d1",
      texto: "Retornar",
      em: "2020-01-01T10:00:00.000Z",
      dono_user_id: "u1",
    },
  });
  const sem = lead({ id: "sem", proxima_acao: null, temperatura: "quente" });
  const quenteComAcao = lead({
    id: "quente",
    temperatura: "quente",
    proxima_acao: {
      demanda_id: "d2",
      texto: "Ligar",
      em: "2099-01-01T10:00:00.000Z",
      dono_user_id: "u1",
    },
  });

  it("serializa e lê os chips novos", () => {
    const f: LeadFilters = { acaoAtrasada: true, semProximaAcao: true, quentes: true };
    const qs = filtersToParams(f);
    expect(qs).toContain("acao_atrasada=1");
    expect(filtersFromParams(new URLSearchParams(qs))).toMatchObject(f);
  });

  it("acaoAtrasada, semProximaAcao e quentes são independentes do prazo de fechamento", () => {
    const todos = [atrasada, sem, quenteComAcao];
    expect(applyFilters(todos, { acaoAtrasada: true }).map((l) => l.id)).toEqual(["atrasada"]);
    expect(applyFilters(todos, { semProximaAcao: true }).map((l) => l.id)).toEqual(["sem"]);
    expect(applyFilters(todos, { quentes: true }).map((l) => l.id).sort()).toEqual(["quente", "sem"]);
    expect(applyFilters(todos, { overdueOnly: true })).toEqual([]);
  });
});
