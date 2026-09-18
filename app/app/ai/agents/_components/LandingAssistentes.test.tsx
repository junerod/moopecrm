import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LandingAssistentes, ordenarAssistentes } from "./LandingAssistentes";

vi.mock("../_actions", () => ({
  pauseAgentAction: vi.fn(async () => ({ ok: true as const })),
}));

import { pauseAgentAction } from "../_actions";

const base = {
  description: "Recebe o cliente",
  specialtyKey: "recepcao" as string | null,
  principal: false,
  jaExistia: false,
};

describe("ordenarAssistentes", () => {
  it("ativos ficam antes dos inativos, sem embaralhar o resto", () => {
    const out = ordenarAssistentes([
      { id: "1", name: "Inativo A", ativo: false, ...base },
      { id: "2", name: "Ativo", ativo: true, ...base },
      { id: "3", name: "Inativo B", ativo: false, ...base },
    ]);
    expect(out.map((c) => c.id)).toEqual(["2", "1", "3"]);
  });
});

describe("LandingAssistentes", () => {
  beforeEach(() => {
    vi.mocked(pauseAgentAction).mockClear();
    vi.mocked(pauseAgentAction).mockResolvedValue({ ok: true });
  });

  it("mostra o próximo passo quando o assistente ainda não publica", () => {
    render(
      <LandingAssistentes
        packAtivo={false}
        packLabel={null}
        cards={[
          {
            id: "ag-1",
            name: "Recepção",
            description: "Recebe o cliente",
            ativo: false,
            specialtyKey: "recepcao",
            principal: true,
            jaExistia: false,
          },
        ]}
        canWrite
      />,
    );
    expect(screen.getByTestId("proximo-passo")).toBeTruthy();
    expect(screen.getByTestId("publicar-assistente-ag-1")).toHaveAttribute(
      "href",
      "/app/ai/agents/ag-1",
    );
  });

  it("no card ativo oferece Desativar; no inativo, Publicar — e ativos vêm primeiro", async () => {
    const user = userEvent.setup();
    render(
      <LandingAssistentes
        packAtivo
        packLabel="Escritório"
        packId="escritorio_advocacia"
        cards={[
          {
            id: "inativo-1",
            name: "Financeiro",
            description: "Cobrança",
            ativo: false,
            specialtyKey: "financeiro",
            principal: false,
            jaExistia: false,
          },
          {
            id: "ativo-1",
            name: "Recepção comercial",
            description: "Porta da frente",
            ativo: true,
            specialtyKey: "recepcao",
            principal: true,
            jaExistia: false,
          },
        ]}
        canWrite
      />,
    );

    const cards = screen.getByTestId("meus-assistentes").querySelectorAll("li");
    expect(cards[0]).toHaveTextContent("Recepção comercial");
    expect(cards[1]).toHaveTextContent("Financeiro");

    expect(screen.getByTestId("desativar-assistente-ativo-1")).toBeTruthy();
    expect(screen.getByTestId("publicar-assistente-inativo-1")).toHaveAttribute(
      "href",
      "/app/ai/agents/inativo-1",
    );

    await user.click(screen.getByTestId("desativar-assistente-ativo-1"));
    expect(pauseAgentAction).toHaveBeenCalledWith("ativo-1");
    expect(await screen.findByTestId("publicar-assistente-ativo-1")).toBeTruthy();
    expect(screen.queryByTestId("desativar-assistente-ativo-1")).toBeNull();
  });
});
