import { beforeEach, describe, expect, it, vi } from "vitest";

import { garantirLeadAoMarcar } from "./marcar-papel";
import type { CrmSummaryData } from "./crm-summary-tipos";

const post = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    post: (...args: unknown[]) => post(...args),
    get: vi.fn(),
  },
}));

function summary(over: Partial<CrmSummaryData> = {}): CrmSummaryData {
  return {
    leads: [],
    negocio: { resolucao: "nenhum", lead_id: null, leads_abertos: [] },
    pipelines_utilizaveis: [
      {
        id: "p1",
        name: "Vendas",
        is_default: true,
        etapas: [
          {
            id: "s1",
            name: "Novo",
            pipeline_id: "p1",
            is_won: false,
            is_lost: false,
          },
        ],
      },
    ],
    proximo_passo_comercial: null,
    orders: [],
    activities: [],
    demandas: [],
    ...over,
  };
}

describe("garantirLeadAoMarcar", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { id: "l1" } });
  });

  it("abre card só quando não há negócio aberto", async () => {
    await garantirLeadAoMarcar({
      contactId: "c1",
      contactName: "Auto Locação",
      summary: summary(),
    });
    expect(post).toHaveBeenCalledWith(
      "/api/v1/leads",
      expect.objectContaining({
        contact_id: "c1",
        pipeline_id: "p1",
        stage_id: "s1",
        reuse_open_if_exists: true,
      }),
    );
  });

  it("não cria segundo card se já existe negócio", async () => {
    await garantirLeadAoMarcar({
      contactId: "c1",
      contactName: "Auto Locação",
      summary: summary({
        negocio: { resolucao: "unico", lead_id: "l-ja", leads_abertos: [] },
      }),
    });
    expect(post).not.toHaveBeenCalled();
  });
});
