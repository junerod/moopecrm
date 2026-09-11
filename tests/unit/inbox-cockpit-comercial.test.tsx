import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CRMSidePanel } from "@/components/inbox/CRMSidePanel";
import type { CrmSummaryData, LeadFicha } from "@/lib/inbox/crm-summary-tipos";

function renderPainel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CRMSidePanel conversation={conversation} />
    </QueryClientProvider>,
  );
}

const CONTACT = "c0000000-0000-4000-8000-000000000001";

const conversation = {
  id: "cv-1",
  organization_id: "org-1",
  contact_id: CONTACT,
  tags: [],
  contacts: { id: CONTACT, display_name: "João Silva", name: null, phone_number: "+5548999910000", tags: [] },
} as unknown as React.ComponentProps<typeof CRMSidePanel>["conversation"];

const ETAPA_NOVO = { id: "s-novo", name: "Novo Lead", pipeline_id: "p-1", is_won: false, is_lost: false };
const ETAPA_QUALI = { id: "s-quali", name: "Qualificado", pipeline_id: "p-1", is_won: false, is_lost: false };

function lead(parcial: Partial<LeadFicha> = {}): LeadFicha {
  return {
    id: "l-1",
    title: "João Silva",
    status: "open",
    value_cents: null,
    currency: "BRL",
    updated_at: "2026-09-10T12:00:00.000Z",
    last_activity_at: null,
    source: "whatsapp",
    pipeline: { id: "p-1", name: "Comercial MOOPE", is_default: true },
    stage: ETAPA_NOVO,
    owner: { user_id: null, agent_id: null, display_name: null },
    temperatura: null,
    ...parcial,
  };
}

function summary(parcial: Partial<CrmSummaryData> = {}): CrmSummaryData {
  const aberto = lead();
  return {
    leads: [aberto],
    negocio: { resolucao: "unico", lead_id: aberto.id, leads_abertos: [aberto] },
    pipelines_utilizaveis: [
      { id: "p-1", name: "Comercial MOOPE", is_default: true, etapas: [ETAPA_NOVO, ETAPA_QUALI] },
    ],
    proximo_passo_comercial: {
      demanda_id: "d-1",
      proximo_passo: "Ligar amanhã",
      proximo_passo_em: "2026-09-11T13:00:00.000Z",
    },
    orders: [],
    activities: [],
    demandas: [],
    ...parcial,
  };
}

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/inbox/useConversationTags", () => ({
  useUpdateConversationTags: () => ({ mutate: vi.fn(), isPending: false }),
  useConversationTagVocabulary: () => ({ data: [] }),
}));
vi.mock("@/hooks/contacts/useUpdateContact", () => ({
  useUpdateContact: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/kanban/useCreateLead", () => ({
  useCreateLead: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  get.mockImplementation((path: unknown) => {
    const p = String(path);
    if (p.includes("/copilot")) return Promise.resolve({ data: { suggestion: null } });
    if (p.includes("/ai-actions")) return Promise.resolve({ data: { requests: [] } });
    return Promise.resolve({ data: summary() });
  });
});

describe("cockpit comercial na Inbox", () => {
  it("mostra funil, etapa e responsável do lead OPEN", async () => {
    renderPainel();
    const bloco = await screen.findByTestId("inbox-ficha-negocio");
    expect(bloco.textContent).toMatch(/Comercial MOOPE/);
    expect(screen.getByTestId("inbox-negocio-etapa")).toHaveValue("s-novo");
    expect(screen.getByTestId("inbox-negocio-responsavel").textContent).toMatch(/sem responsável/i);
    expect(screen.getByTestId("inbox-abrir-no-quadro")).toHaveAttribute("href", "/app/leads/l-1");
  });

  it("próximo passo já gravado continua visível e editável", async () => {
    renderPainel();
    const texto = (await screen.findByTestId("inbox-proximo-passo-texto")) as HTMLInputElement;
    expect(texto.value).toMatch(/ligar amanhã/i);
    expect((screen.getByTestId("inbox-proximo-passo-data") as HTMLInputElement).value).not.toBe("");
  });

  it("alterar etapa chama /move e relê", async () => {
    post.mockResolvedValue({ data: { id: "l-1" } });
    renderPainel();
    await screen.findByTestId("inbox-negocio-etapa");
    const antes = get.mock.calls.length;
    await userEvent.selectOptions(screen.getByTestId("inbox-negocio-etapa"), "s-quali");
    await waitFor(() => expect(post).toHaveBeenCalled());
    const [rota, corpo] = post.mock.calls[0] as [string, Record<string, unknown>];
    expect(rota).toBe("/api/v1/leads/l-1/move");
    expect(corpo.stage_id).toBe("s-quali");
    expect(corpo.expected_updated_at).toBe("2026-09-10T12:00:00.000Z");
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(antes));
  });

  it("sem lead OPEN mostra Adicionar ao funil — não escolhe card", async () => {
    get.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes("/copilot")) return Promise.resolve({ data: { suggestion: null } });
      if (p.includes("/ai-actions")) return Promise.resolve({ data: { requests: [] } });
      return Promise.resolve({
        data: summary({
          leads: [],
          negocio: { resolucao: "nenhum", lead_id: null, leads_abertos: [] },
          proximo_passo_comercial: null,
        }),
      });
    });
    renderPainel();
    expect(await screen.findByTestId("inbox-adicionar-ao-funil")).toBeTruthy();
    expect(screen.queryByTestId("inbox-negocio-unico")).toBeNull();
  });

  it("dois OPEN: lista os dois e não opera um em silêncio", async () => {
    const a = lead({ id: "l-a", title: "MOOPE 2026" });
    const b = lead({ id: "l-b", title: "Locação 2027", stage: ETAPA_QUALI });
    get.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes("/copilot")) return Promise.resolve({ data: { suggestion: null } });
      if (p.includes("/ai-actions")) return Promise.resolve({ data: { requests: [] } });
      return Promise.resolve({
        data: summary({
          leads: [a, b],
          negocio: { resolucao: "varios", lead_id: null, leads_abertos: [a, b] },
        }),
      });
    });
    renderPainel();
    const lista = await screen.findByTestId("inbox-negocios-varios");
    expect(lista.textContent).toMatch(/MOOPE 2026/);
    expect(lista.textContent).toMatch(/Locação 2027/);
    expect(screen.queryByTestId("inbox-negocio-etapa")).toBeNull();
    const links = screen.getAllByTestId("inbox-lead-aberto");
    expect(links[0]).toHaveAttribute("href", "/app/leads/l-a");
    expect(links[1]).toHaveAttribute("href", "/app/leads/l-b");
  });

  it("Equipe esconde o bloco comercial e diz que é conversa da equipe", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const base = conversation!;
    const equipe = {
      ...base,
      contacts: { ...base.contacts, papel: "equipe", name: "TEC Paulo" },
    } as NonNullable<typeof conversation>;
    render(
      <QueryClientProvider client={client}>
        <CRMSidePanel conversation={equipe} />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("conversa-da-equipe")).toBeTruthy();
    expect(screen.queryByTestId("inbox-ficha-negocio")).toBeNull();
  });

  it("Ignorar também esconde o bloco comercial", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const base = conversation!;
    const ignorado = {
      ...base,
      contacts: { ...base.contacts, papel: "ignorado", name: "Spam" },
    } as NonNullable<typeof conversation>;
    render(
      <QueryClientProvider client={client}>
        <CRMSidePanel conversation={ignorado} />
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("conversa-ignorada")).toBeTruthy();
    expect(screen.queryByTestId("inbox-ficha-negocio")).toBeNull();
  });
});
