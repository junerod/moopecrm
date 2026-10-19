/**
 * A limpeza da caixa pede duas vezes. A primeira só explica. A API só sai
 * depois da palavra LIMPAR na segunda.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/client", () => ({
  apiClient: { post: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import { LimparCaixaButton } from "@/components/inbox/LimparCaixaButton";

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset();
});

function montar() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <LimparCaixaButton />
    </QueryClientProvider>,
  );
}

describe("limpar caixa na tela", () => {
  it("não chama a API na primeira pergunta", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByTestId("limpar-caixa"));
    expect(screen.getByText("Limpar a caixa de entrada?")).toBeInTheDocument();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("a segunda tela pede LIMPAR e o botão fica morto até a palavra", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByTestId("limpar-caixa"));
    await user.click(screen.getByTestId("limpar-caixa-continuar"));
    expect(screen.getByText("Confirme de novo")).toBeInTheDocument();
    expect(screen.getByTestId("limpar-caixa-confirmar")).toBeDisabled();
    await user.type(screen.getByTestId("confirmar-limpar"), "sim");
    expect(screen.getByTestId("limpar-caixa-confirmar")).toBeDisabled();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it("só dispara depois de LIMPAR", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { apagadas: 3 } });
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByTestId("limpar-caixa"));
    await user.click(screen.getByTestId("limpar-caixa-continuar"));
    await user.type(screen.getByTestId("confirmar-limpar"), "LIMPAR");
    await user.click(screen.getByTestId("limpar-caixa-confirmar"));
    expect(apiClient.post).toHaveBeenCalledWith(
      "/api/v1/conversations/purge-inbox",
      { confirm: "LIMPAR" },
      { timeoutMs: 120_000 },
    );
  });
});
