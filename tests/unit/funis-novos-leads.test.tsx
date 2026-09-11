import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { FunisClient, type FunilDaLista } from "@/app/app/kanban/_client";

vi.mock("@/hooks/pipelines/usePipelines", () => ({
  useCriarFunil: () => ({ isPending: false, mutate: vi.fn() }),
  useEditarFunil: () => ({ isPending: false, mutate: vi.fn() }),
  useArquivarFunil: () => ({ isPending: false, mutate: vi.fn() }),
  useGravarFunilDeNovosLeads: () => ({ isPending: false, mutate: vi.fn() }),
}));

function funil(id: string, name: string, is_default = false): FunilDaLista {
  return { id, name, slug: name.toLowerCase(), description: null, position: 1, is_default };
}

const PADRAO = funil("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Locatários", true);
const COMERCIAL = funil("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Comercial");

describe("Funis — novos leads entram em", () => {
  it("um funil só: não pede configuração", () => {
    render(<FunisClient funis={[PADRAO]} podeGerenciar inboundPipelineId={null} />);
    expect(screen.queryByTestId("funil-de-novos-leads")).not.toBeInTheDocument();
    expect(screen.queryByText("Novos contatos")).not.toBeInTheDocument();
  });

  it("vários funis: select sem UUID e texto curto", () => {
    render(
      <FunisClient funis={[PADRAO, COMERCIAL]} podeGerenciar inboundPipelineId={COMERCIAL.id} />,
    );
    expect(screen.getByTestId("funil-de-novos-leads")).toBeInTheDocument();
    expect(screen.getByLabelText("Novos leads entram em")).toBeInTheDocument();
    expect(
      screen.getByText(/Quando uma nova conversa gerar uma oportunidade automaticamente/),
    ).toBeInTheDocument();
    expect(screen.getByTestId("funil-de-novos-leads-select")).not.toHaveTextContent(
      COMERCIAL.id,
    );
    expect(screen.getByRole("option", { name: "Comercial" })).toBeInTheDocument();
    expect(screen.getAllByText("Novos contatos").length).toBeGreaterThan(0);
  });

  it("viewer não configura", () => {
    render(
      <FunisClient funis={[PADRAO, COMERCIAL]} podeGerenciar={false} inboundPipelineId={null} />,
    );
    expect(screen.queryByTestId("funil-de-novos-leads")).not.toBeInTheDocument();
  });
});
