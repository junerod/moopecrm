import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProximaAcaoLinha } from "@/lib/demandas/listar-proximas-acoes";

vi.mock("@/lib/demandas/listar-proximas-acoes", () => ({
  listarProximasAcoes: vi.fn(),
}));
vi.mock("@/lib/supervisao/kpis", () => ({
  carregarKpisDeSupervisao: vi.fn(),
}));
vi.mock("@/lib/routing/queue", () => ({
  getQueueStatus: vi.fn(),
}));
vi.mock("@/lib/leads/radar-de-risco", () => ({
  carregaRadarDeRisco: vi.fn(),
}));
vi.mock("@/lib/escalacao/atendentes", () => ({
  carregarRosterDeAtendimento: vi.fn(),
  podeAssumirAgora: vi.fn(() => true),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { listarProximasAcoes } from "@/lib/demandas/listar-proximas-acoes";
import { carregarRosterDeAtendimento } from "@/lib/escalacao/atendentes";
import { carregaRadarDeRisco } from "@/lib/leads/radar-de-risco";
import { getQueueStatus } from "@/lib/routing/queue";
import { carregarKpisDeSupervisao } from "@/lib/supervisao/kpis";

import { carregarSnapshotDaHome } from "./snapshot";

const agora = new Date("2026-09-12T15:00:00.000Z");
const ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const USER = "11111111-1111-1111-1111-111111111111";

function acao(parcial: Partial<ProximaAcaoLinha> & Pick<ProximaAcaoLinha, "demanda_id" | "estado">): ProximaAcaoLinha {
  return {
    contact_id: "c1",
    lead_id: "l1",
    conversation_id: "v1",
    texto: "Retornar",
    em: agora.toISOString(),
    dono_user_id: USER,
    contact_name: "Maria",
    lead_title: "Lead",
    temperatura: null,
    atraso: null,
    quando: "hoje",
    ...parcial,
  };
}

function dbComContagens(opts?: { mine?: number; unassigned?: number; org?: string }) {
  const visto: string[] = [];
  const builder = {
    select() {
      return this;
    },
    eq(col: string, val: unknown) {
      if (col === "organization_id") visto.push(String(val));
      return this;
    },
    not() {
      return this;
    },
    is() {
      return this;
    },
    in() {
      return this;
    },
    gte() {
      return this;
    },
    lt() {
      return this;
    },
    order() {
      return this;
    },
    limit() {
      return this;
    },
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(
        resolve({
          data: [],
          count: opts?.mine ?? 0,
          error: null,
        }),
      );
    },
  };
  return {
    visto,
    from() {
      return builder;
    },
  };
}

const kpisOk = {
  atendimento: {
    fila: 3,
    espera_mais_antiga_s: 720,
    primeira_resposta_media_s: 134,
    conversas_abertas: 8,
    conversas_por_atendente: [],
  },
  comercial: {
    leads_novos: 4,
    oportunidades_abertas: 10,
    sem_proxima_acao: 2,
    atrasadas: 1,
    ganhos: 3,
    perdidos: 1,
    conversao: 0.75,
  },
  funil: [
    { stage_id: "s1", stage_name: "Novo", pipeline_id: "p1", count: 5, value_cents: 100000 },
  ],
  campanhas: { executadas: 1, enviados: 10, respostas: 2, leads_associados: 0, opt_outs: 0 },
  atendentes: [],
};

describe("carregarSnapshotDaHome", () => {
  beforeEach(() => {
    vi.mocked(listarProximasAcoes).mockReset();
    vi.mocked(carregarKpisDeSupervisao).mockReset();
    vi.mocked(getQueueStatus).mockReset();
    vi.mocked(carregaRadarDeRisco).mockReset();
    vi.mocked(carregarRosterDeAtendimento).mockReset();
    vi.mocked(listarProximasAcoes).mockResolvedValue([]);
    vi.mocked(carregarKpisDeSupervisao).mockResolvedValue(kpisOk);
    vi.mocked(getQueueStatus).mockResolvedValue({
      queue_size: 3,
      avg_wait_seconds: 100,
      online_eligible_count: 2,
      oldest_wait_seconds: 720,
    });
    vi.mocked(carregaRadarDeRisco).mockResolvedValue({
      items: [],
      counts: { critico: 0, em_risco: 0, em_voo: 0 },
      total: 5,
      sem_proximo_passo: [],
      total_sem_proximo_passo: 2,
    });
    vi.mocked(carregarRosterDeAtendimento).mockResolvedValue([]);
  });

  it("snapshot pessoal conta atrasada, hoje e quente sem ação", async () => {
    vi.mocked(listarProximasAcoes).mockResolvedValue([
      acao({
        demanda_id: "d1",
        estado: "atrasada",
        em: "2026-09-11T10:00:00.000Z",
        contact_name: "Carlos",
      }),
      acao({ demanda_id: "d2", estado: "aberta", texto: "Hoje", contact_name: "Marina" }),
      acao({
        demanda_id: "d3",
        estado: "sem",
        texto: null,
        em: null,
        temperatura: "quente",
        contact_name: "Quente",
      }),
    ]);
    const db = dbComContagens({ mine: 4 });
    const snap = await carregarSnapshotDaHome(db as never, {
      organizationId: ORG_A,
      userId: USER,
      role: "agent",
      periodo: "7d",
      agora,
    });
    expect(snap.papel).toBe("agent");
    expect(snap.personal.atrasadas).toBe(1);
    expect(snap.personal.hoje).toBe(1);
    expect(snap.personal.quentes_sem_acao).toBe(1);
    expect(snap.personal.acoes.some((a) => a.contact_name === "Carlos")).toBe(true);
    expect(snap.personal.acoes.some((a) => a.contact_name === "Marina")).toBe(true);
    expect(snap.team).toBeNull();
    expect(snap.commercial).toBeNull();
    expect(snap.campaigns).toBeNull();
    expect(carregarKpisDeSupervisao).not.toHaveBeenCalled();
    expect(getQueueStatus).not.toHaveBeenCalled();
    expect(carregaRadarDeRisco).not.toHaveBeenCalled();
  });

  it("manager recebe team e commercial; agent não", async () => {
    const db = dbComContagens();
    const agent = await carregarSnapshotDaHome(db as never, {
      organizationId: ORG_A,
      userId: USER,
      role: "agent",
      periodo: "7d",
      agora,
    });
    const manager = await carregarSnapshotDaHome(db as never, {
      organizationId: ORG_A,
      userId: USER,
      role: "manager",
      periodo: "7d",
      agora,
    });
    expect(agent.sources.team).toBe("omit");
    expect(manager.team?.fila).toBe(3);
    expect(manager.team?.espera_mais_antiga_s).toBe(720);
    expect(manager.commercial?.ganhos).toBe(3);
    expect(manager.commercial?.paradas).toBe(5);
    expect(manager.funnel[0]?.count).toBe(5);
    expect(manager.commercial?.vs_anterior?.leads_novos).toBe(4);
  });

  it("vs_anterior usa a janela imediatamente anterior, sem inventar", async () => {
    vi.mocked(carregarKpisDeSupervisao).mockImplementation(async (_db, opts) => {
      const anterior = opts.from.getTime() < agora.getTime() - 7 * 86400000;
      if (anterior) {
        return {
          ...kpisOk,
          comercial: { ...kpisOk.comercial, leads_novos: 2, ganhos: 1, conversao: 0.5 },
        };
      }
      return kpisOk;
    });
    const db = dbComContagens();
    const manager = await carregarSnapshotDaHome(db as never, {
      organizationId: ORG_A,
      userId: USER,
      role: "manager",
      periodo: "7d",
      agora,
    });
    expect(manager.commercial?.leads_novos).toBe(4);
    expect(manager.commercial?.vs_anterior).toEqual({
      leads_novos: 2,
      ganhos: 1,
      conversao: 0.5,
      primeira_resposta_media_s: 134,
    });
  });

  it("período 7d é o default da janela da supervisão", async () => {
    const db = dbComContagens();
    await carregarSnapshotDaHome(db as never, {
      organizationId: ORG_A,
      userId: USER,
      role: "manager",
      periodo: "7d",
      agora,
    });
    expect(carregarKpisDeSupervisao).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organizationId: ORG_A,
        from: expect.any(Date),
        to: agora,
      }),
    );
    const from = vi.mocked(carregarKpisDeSupervisao).mock.calls[0]![1].from.getTime();
    expect(agora.getTime() - from).toBe(7 * 86400000);
  });

  it("empty state pessoal zera contagens sem inventar KPI", async () => {
    const db = dbComContagens({ mine: 0 });
    const snap = await carregarSnapshotDaHome(db as never, {
      organizationId: ORG_A,
      userId: USER,
      role: "agent",
      periodo: "hoje",
      agora,
    });
    expect(snap.personal).toMatchObject({
      atrasadas: 0,
      hoje: 0,
      quentes_sem_acao: 0,
      conversas_minhas: 0,
      acoes: [],
    });
  });

  it("falha parcial do funil não zera o pessoal", async () => {
    vi.mocked(listarProximasAcoes).mockResolvedValue([
      acao({ demanda_id: "d1", estado: "atrasada", em: "2026-09-10T10:00:00.000Z" }),
    ]);
    vi.mocked(carregarKpisDeSupervisao).mockRejectedValue(new Error("boom"));
    const db = dbComContagens({ mine: 2 });
    const snap = await carregarSnapshotDaHome(db as never, {
      organizationId: ORG_A,
      userId: USER,
      role: "manager",
      periodo: "7d",
      agora,
    });
    expect(snap.personal.atrasadas).toBe(1);
    expect(snap.sources.funnel).toBe("error");
    expect(snap.funnel).toEqual([]);
  });

  it("tenant: organization_id do pedido vai para as demandas", async () => {
    const db = dbComContagens();
    await carregarSnapshotDaHome(db as never, {
      organizationId: ORG_B,
      userId: USER,
      role: "agent",
      periodo: "7d",
      agora,
    });
    expect(listarProximasAcoes).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ organizationId: ORG_B, ownerUserId: USER }),
    );
    expect(db.visto.every((id) => id === ORG_B)).toBe(true);
  });
});
