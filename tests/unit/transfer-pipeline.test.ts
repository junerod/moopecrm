/**
 * @vitest-environment node
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api/types";

const createLeadHandler = vi.fn();
const encerraDemanda = vi.fn();
const emitLeadActivity = vi.fn();
const registraFalhaDeAtividade = vi.fn();
const audit = vi.fn();

vi.mock("@/app/api/v1/leads/_handler", () => ({
  createLeadHandler: (...args: unknown[]) => createLeadHandler(...args),
}));
vi.mock("@/lib/leads/encerramento", () => ({
  encerraDemanda: (...args: unknown[]) => encerraDemanda(...args),
}));
vi.mock("@/lib/leads/activity-emitter", () => ({
  emitLeadActivity: (...args: unknown[]) => emitLeadActivity(...args),
}));
vi.mock("@/lib/leads/activity-write-failure", () => ({
  registraFalhaDeAtividade: (...args: unknown[]) => registraFalhaDeAtividade(...args),
}));
vi.mock("@/lib/audit", () => ({
  audit: (...args: unknown[]) => audit(...args),
}));

import { transferLeadToPipeline } from "@/lib/leads/transfer-pipeline";

function chain(row: unknown, error: unknown = null) {
  const q: Record<string, unknown> = {};
  const self = () => q;
  for (const m of ["select", "eq", "neq", "order", "limit", "is", "in"]) {
    q[m] = vi.fn(self);
  }
  q.maybeSingle = vi.fn(async () => ({ data: row, error }));
  q.single = vi.fn(async () => ({ data: row, error }));
  return q;
}

describe("transferLeadToPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createLeadHandler.mockResolvedValue({ id: "new-1" });
    encerraDemanda.mockResolvedValue({ lead: {}, jaEstava: false });
    emitLeadActivity.mockResolvedValue({ ok: true });
    audit.mockResolvedValue(undefined);
  });

  it("recusa mesmo funil", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "crm_leads") {
          return chain({
            id: "l1",
            pipeline_id: "p1",
            status: "open",
            title: "Acme",
            organization_id: "o1",
          });
        }
        return chain(null);
      }),
    };

    await expect(
      transferLeadToPipeline(
        supabase as never,
        { organization_id: "o1", actor: { type: "user", id: "u1" }, requestId: "r1" },
        { leadId: "l1", targetPipelineId: "p1" },
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("cria no destino e fecha a origem", async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "crm_leads") {
          return chain({
            id: "l1",
            pipeline_id: "p-vendas",
            status: "open",
            title: "Acme",
            description: null,
            contact_id: "c1",
            value_cents: 1000,
            currency: "BRL",
            tags: [],
            source: "manual",
            owner_user_id: null,
            owner_agent_id: null,
            custom_fields: {},
            organization_id: "o1",
          });
        }
        if (table === "crm_pipelines") {
          return chain({ id: "p-suporte", name: "Suporte", is_archived: false });
        }
        if (table === "crm_stages") {
          return chain({ id: "s-novo" });
        }
        return chain(null);
      }),
    };

    const result = await transferLeadToPipeline(
      supabase as never,
      { organization_id: "o1", actor: { type: "user", id: "u1" }, requestId: "r1" },
      { leadId: "l1", targetPipelineId: "p-suporte" },
    );

    expect(result.new_lead_id).toBe("new-1");
    expect(result.target_stage_id).toBe("s-novo");
    expect(createLeadHandler).toHaveBeenCalled();
    expect(encerraDemanda).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ leadId: "l1", desfecho: "lost", motivo: "other" }),
    );
  });
});
