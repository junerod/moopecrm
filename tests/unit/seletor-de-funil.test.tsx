import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { PipelinePageClient } from "@/app/app/pipelines/[id]/_client";

vi.mock("@/hooks/kanban/useBoard", () => ({
  useBoard: () => ({
    data: {
      pipeline: { id: "p1", name: "Vendas" },
      stages: [],
      leads: [],
    },
    isLoading: false,
    error: null,
    pulses: {},
    realtimeStatus: "subscribed",
    seguranca: { divergencias: 0, ultimaVerificacao: null },
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/pipelines/p1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/kanban/KanbanBoard", () => ({
  KanbanBoard: () => <div>quadro</div>,
}));
vi.mock("@/components/kanban/FilterBar", () => ({
  FilterBar: () => null,
}));
vi.mock("@/components/kanban/BulkActionBar", () => ({
  BulkActionBar: () => null,
}));
vi.mock("@/components/kanban/NewLeadDialog", () => ({
  NewLeadDialog: () => null,
}));

const FUNIS = [
  { id: "p1", name: "Vendas", is_default: true },
  { id: "p2", name: "Processos", is_default: false },
];

describe("seletor de funil no quadro", () => {
  it("um funil só: não mostra seletor", () => {
    render(
      <PipelinePageClient
        pipelineId="p1"
        initialName="Vendas"
        funis={[FUNIS[0]!]}
        inboundPipelineId="p1"
      />,
    );
    expect(screen.queryByTestId("seletor-de-funil")).not.toBeInTheDocument();
  });

  it("vários funis: seletor troca só a visualização", () => {
    render(
      <PipelinePageClient
        pipelineId="p1"
        initialName="Vendas"
        funis={FUNIS}
        inboundPipelineId="p1"
      />,
    );
    const sel = screen.getByTestId("seletor-de-funil") as HTMLSelectElement;
    expect(sel.value).toBe("p1");
    expect(sel).toHaveTextContent("Vendas");
    expect(sel).toHaveTextContent("Processos");
    expect(sel).toHaveTextContent("Novos contatos");
  });
});
