import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOME_AGENTE_ATENDIMENTO_LOCADORA,
  promptEhPadraoDeLoja,
  VOZ_ATENDIMENTO_LOCADORA,
} from "@/lib/moope/agente-atendimento-locadora";

vi.mock("@/lib/channels/selectable", () => ({
  listSelectableChannels: vi.fn(async () => [{ id: "canal-1" }]),
}));
vi.mock("@/lib/ai/agents/escolher-modelo", () => ({
  escolherModeloDoProvedor: () => ({ escolhido: true, modelId: "claude-sonnet-4-6" }),
}));
vi.mock("@/lib/ai/runtime/agent", () => ({
  chaveDePlataforma: () => true,
}));
vi.mock("@/lib/moope/cliente-locadora", () => ({
  carregarConexaoLocadora: vi.fn(),
}));
vi.mock("@/lib/ai/agents/capacidades-padrao", () => ({
  catalogoComHandler: () => [
    { name: "crm_search_contacts", risco: "seguro", pacotes: ["atender"] },
    { name: "crm_get_contact", risco: "seguro", pacotes: ["atender"] },
  ],
}));

import { listSelectableChannels } from "@/lib/channels/selectable";
import { carregarConexaoLocadora } from "@/lib/moope/cliente-locadora";
import { garantirAgenteAtendimentoLocadora } from "@/lib/moope/agente-atendimento-locadora";

type Linha = Record<string, unknown>;

function adminDeMemoria(estado: {
  agentes: Linha[];
  versoes: Linha[];
  funis?: Linha[];
}) {
  const abrir = (tabela: string) => {
    const filtros: Record<string, unknown> = {};
    let payload: Linha | null = null;
    let op: "select" | "insert" | "update" = "select";
    const b = {
      select: () => b,
      insert: (p: Linha) => {
        op = "insert";
        payload = p;
        return b;
      },
      update: (p: Linha) => {
        op = "update";
        payload = p;
        return b;
      },
      eq: (k: string, v: unknown) => {
        filtros[k] = v;
        return b;
      },
      is: (k: string, v: unknown) => {
        filtros[k] = v;
        return b;
      },
      in: () => b,
      not: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: async () => {
        if (tabela === "ai_agents") {
          const lista = estado.agentes.filter((a) => {
            if (filtros.name && a.name !== filtros.name) return false;
            if (filtros.is_default === true && a.is_default !== true) return false;
            if (filtros.id && a.id !== filtros.id) return false;
            return true;
          });
          const alvo = lista[0] ?? null;
          if (op === "update" && alvo && payload) Object.assign(alvo, payload);
          return { data: alvo, error: null };
        }
        if (tabela === "ai_agent_versions") {
          if (filtros.id) {
            return { data: estado.versoes.find((v) => v.id === filtros.id) ?? null, error: null };
          }
          const doAgente = estado.versoes.filter((v) => !filtros.agent_id || v.agent_id === filtros.agent_id);
          return { data: doAgente[0] ?? null, error: null };
        }
        if (tabela === "organizations") return { data: { settings: {} }, error: null };
        if (tabela === "ai_models") return { data: [], error: null };
        if (tabela === "ai_provider_credentials") return { data: null, error: null };
        if (tabela === "crm_pipelines") return { data: estado.funis ?? [], error: null };
        return { data: null, error: null };
      },
      single: async () => {
        if (tabela === "ai_agents" && op === "insert" && payload) {
          const linha = { id: "ag-novo", published_version_id: null, ...payload };
          estado.agentes.push(linha);
          return { data: { id: linha.id }, error: null };
        }
        if (tabela === "ai_agent_versions" && op === "insert" && payload) {
          const linha = { id: `v-${estado.versoes.length + 1}`, ...payload };
          estado.versoes.push(linha);
          return { data: { id: linha.id }, error: null };
        }
        return { data: null, error: { message: "unexpected" } };
      },
      then: (ok: (r: { data: unknown; error: null }) => unknown) => {
        if (tabela === "ai_agents") {
          if (op === "update" && payload) {
            for (const a of estado.agentes) {
              if (filtros.id && a.id !== filtros.id) continue;
              Object.assign(a, payload);
            }
          }
          return Promise.resolve(ok({ data: estado.agentes, error: null }));
        }
        if (tabela === "ai_agent_versions") return Promise.resolve(ok({ data: estado.versoes, error: null }));
        if (tabela === "crm_pipelines") return Promise.resolve(ok({ data: estado.funis ?? [], error: null }));
        if (tabela === "ai_models") return Promise.resolve(ok({ data: [], error: null }));
        return Promise.resolve(ok({ data: [], error: null }));
      },
    };
    return b;
  };
  return { from: abrir };
}

describe("voz do agente", () => {
  it("texto de loja do onboarding é o que se adapta", () => {
    expect(promptEhPadraoDeLoja("Você atende os clientes de Loja X. Fale de forma")).toBe(true);
    expect(promptEhPadraoDeLoja(VOZ_ATENDIMENTO_LOCADORA)).toBe(false);
    expect(VOZ_ATENDIMENTO_LOCADORA).toMatch(/moope_listar_oferta/);
    expect(VOZ_ATENDIMENTO_LOCADORA).toMatch(/página de ofertas|ALUGADO/);
  });
});

describe("garantirAgenteAtendimentoLocadora", () => {
  beforeEach(() => {
    vi.mocked(carregarConexaoLocadora).mockReset();
    vi.mocked(listSelectableChannels).mockResolvedValue([{ id: "canal-1" }] as never);
  });

  it("sem conexão locadora não cria agente", async () => {
    vi.mocked(carregarConexaoLocadora).mockResolvedValue(null);
    const r = await garantirAgenteAtendimentoLocadora(adminDeMemoria({ agentes: [], versoes: [] }) as never, "org", "u");
    expect(r).toEqual({ ok: false, motivo: "nao_e_locadora" });
  });

  it("se já existe o nome, não duplica", async () => {
    vi.mocked(carregarConexaoLocadora).mockResolvedValue({ id: "cx" } as never);
    const r = await garantirAgenteAtendimentoLocadora(
      adminDeMemoria({
        agentes: [{ id: "ag-1", name: NOME_AGENTE_ATENDIMENTO_LOCADORA, published_version_id: "v1" }],
        versoes: [],
      }) as never,
      "org",
      "u",
    );
    expect(r.origem).toBe("existente");
    expect(r.agent_id).toBe("ag-1");
    expect(r.status).toBe("published");
  });

  it("adapta o default de loja em vez de publicar o segundo no canal", async () => {
    vi.mocked(carregarConexaoLocadora).mockResolvedValue({ id: "cx" } as never);
    const estado = {
      agentes: [
        {
          id: "ag-def",
          name: "Atendente IA",
          is_default: true,
          published_version_id: "v-old",
          system_prompt: "Você atende os clientes de Loja.",
        },
      ],
      versoes: [
        {
          id: "v-old",
          agent_id: "ag-def",
          version_number: 1,
          system_prompt: "Você atende os clientes de Loja.",
          channel_session_id: "canal-1",
          status: "published",
        },
      ],
    };
    const r = await garantirAgenteAtendimentoLocadora(adminDeMemoria(estado) as never, "org", "u");
    expect(r.origem).toBe("adaptado");
    expect(r.agent_id).toBe("ag-def");
    expect(estado.agentes[0]?.name).toBe(NOME_AGENTE_ATENDIMENTO_LOCADORA);
  });

  it("canal já publicado por outro: cria rascunho, não o segundo no ar", async () => {
    vi.mocked(carregarConexaoLocadora).mockResolvedValue({ id: "cx" } as never);
    const estado = {
      agentes: [
        {
          id: "ag-outro",
          name: "Vendas custom",
          is_default: true,
          published_version_id: "v-out",
          system_prompt: "Prompt que o dono escreveu na mão.",
        },
      ],
      versoes: [
        {
          id: "v-out",
          agent_id: "ag-outro",
          channel_session_id: "canal-1",
          status: "published",
        },
      ],
    };
    const r = await garantirAgenteAtendimentoLocadora(adminDeMemoria(estado) as never, "org", "u");
    expect(r.origem).toBe("criado");
    expect(r.status).toBe("draft");
    expect(r.motivo).toBe("canal_ocupado");
    expect(estado.agentes.some((a) => a.name === NOME_AGENTE_ATENDIMENTO_LOCADORA)).toBe(true);
  });
});
