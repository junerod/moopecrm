import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProntasTab } from "./ProntasTab";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe("ProntasTab", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "x", ja_estava_ativo: false } }),
    });
  });

  it("deixa mudar a mensagem e manda no POST — não fica só o texto da semente", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ProntasTab jaAtivo={false} canWrite />);
    const campo = screen.getByTestId("pronto-followup-24h-mensagem");
    await user.clear(campo);
    await user.type(campo, "Ainda quer o orçamento desta semana?");
    await user.click(screen.getByTestId("pronto-followup-24h-ativar"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as { body?: string };
    expect(JSON.parse(init.body ?? "{}")).toEqual({
      mensagem: "Ainda quer o orçamento desta semana?",
      horas: 24,
    });
  });

  it("ligado continua editável — Salvar, não só o rótulo travado", async () => {
    render(
      <ProntasTab
        jaAtivo
        canWrite
        mensagemInicial="Posso te ligar amanhã?"
        horasInicial={12}
      />,
    );
    expect(screen.getByTestId("pronto-followup-24h-ativo")).toBeInTheDocument();
    expect(screen.getByTestId("pronto-followup-24h-mensagem")).toHaveValue(
      "Posso te ligar amanhã?",
    );
    expect(screen.getByTestId("pronto-followup-24h-horas")).toHaveValue(12);
    expect(screen.getByTestId("pronto-followup-24h-salvar")).toBeEnabled();
  });
});
