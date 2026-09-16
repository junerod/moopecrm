import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FluxosProntosDoPack } from "@/components/negocio/FluxosProntosDoPack";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const FLUXO = {
  key: "apos-proposta",
  name: "Follow-up depois de Proposta",
  description: "Quando o card entra nessa etapa, espera e pergunta.",
  quando: "Quando o card entra em “Proposta”, espera 2 horas",
  mensagem: "Olá. Conseguiu olhar as condições?",
  ativo: false,
};

describe("FluxosProntosDoPack", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "x", key: FLUXO.key, ativo: true } }),
    });
  });

  it("mostra o texto editável e liga com a mensagem nova", async () => {
    const user = userEvent.setup({ delay: null });
    render(<FluxosProntosDoPack fluxos={[FLUXO]} canWrite />);
    const campo = screen.getByTestId("fluxo-pronto-apos-proposta-mensagem");
    await user.clear(campo);
    await user.type(campo, "Ainda quer fechar nesta semana?");
    await user.click(screen.getByTestId("fluxo-pronto-apos-proposta-ligar"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]?.[1] as { body?: string };
    expect(JSON.parse(init.body ?? "{}")).toEqual({
      key: "apos-proposta",
      mensagem: "Ainda quer fechar nesta semana?",
      ativo: true,
    });
  });

  it("ligado continua editável", () => {
    render(<FluxosProntosDoPack fluxos={[{ ...FLUXO, ativo: true }]} canWrite />);
    expect(screen.getByTestId("fluxo-pronto-apos-proposta-ativo")).toBeInTheDocument();
    expect(screen.getByTestId("fluxo-pronto-apos-proposta-salvar")).toBeEnabled();
    expect(screen.getByTestId("fluxo-pronto-apos-proposta-desligar")).toBeEnabled();
  });
});
