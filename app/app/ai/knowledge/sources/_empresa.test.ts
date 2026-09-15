import { describe, expect, it } from "vitest";

import { ehConhecimentoVazio } from "./_empresa";
import type { SourceRow } from "@/hooks/ai/useKnowledgeSources";

function fonte(parcial: Partial<SourceRow>): SourceRow {
  return {
    id: "s1",
    agent_id: "a1",
    organization_id: "o1",
    source_type: "policy",
    status: "ready",
    last_index_status: "success",
    last_index_error: null,
    last_indexed_at: null,
    chunks_count: 1,
    is_active: true,
    source_metadata: {},
    created_at: "",
    updated_at: "",
    ...parcial,
  };
}

describe("ehConhecimentoVazio", () => {
  it("vazio quando não há fonte ativa", () => {
    expect(ehConhecimentoVazio([])).toBe(true);
    expect(ehConhecimentoVazio([fonte({ is_active: false })])).toBe(true);
    expect(ehConhecimentoVazio([fonte({ status: "archived" })])).toBe(true);
  });

  it("não pede material quando já existe fonte pronta", () => {
    expect(ehConhecimentoVazio([fonte({})])).toBe(false);
  });
});
