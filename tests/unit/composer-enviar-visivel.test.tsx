import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("@/hooks/inbox/useSendMessage", () => ({
  useSendMessage: () => ({ mutate: sendMock, isPending: false }),
}));
vi.mock("@/hooks/inbox/useCreateNote", () => ({
  useCreateNote: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useUploadMedia", () => ({
  useUploadMedia: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/inbox/useMessageTemplates", () => ({
  useMessageTemplates: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/inbox/useDraftReply", () => ({
  useDraftReply: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { Composer } from "@/components/inbox/Composer";

function renderComposer() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <Composer conversationId="conv-1" />
    </QueryClientProvider>,
  );
}

describe("Composer — botão Enviar sempre visível", () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it("mostra Enviar mesmo com o campo vazio — no celular não há Enter", () => {
    renderComposer();
    const enviar = screen.getByTestId("inbox-enviar");
    expect(enviar).toBeVisible();
    expect(enviar).toBeDisabled();
    expect(screen.getByTestId("inbox-composer")).toHaveAttribute("enterkeyhint", "send");
  });

  it("o clique em Enviar manda o texto, sem depender do teclado", () => {
    renderComposer();
    fireEvent.change(screen.getByTestId("inbox-composer"), { target: { value: "vamos seguir" } });
    const enviar = screen.getByTestId("inbox-enviar");
    expect(enviar).toBeEnabled();
    fireEvent.click(enviar);
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ conversation_id: "conv-1", body: "vamos seguir", type: "text" }),
      expect.anything(),
    );
  });
});
