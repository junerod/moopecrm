import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/inbox/useSendMessage", () => ({
  useSendMessage: () => ({ mutate: vi.fn(), isPending: false }),
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

describe("Composer — rascunho e resposta rápida", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("traz de volta o texto se a conversa já tinha rascunho", async () => {
    localStorage.setItem("inbox-rascunho:conv-1", "texto que não pode sumir");
    renderComposer();
    expect(await screen.findByDisplayValue("texto que não pode sumir")).toBeInTheDocument();
    expect(screen.getByTestId("inbox-composer")).toHaveAttribute("lang", "pt-BR");
  });

  it("mostra salvar resposta rápida quando há texto para copiar", () => {
    renderComposer();
    expect(screen.queryByTestId("salvar-resposta-rapida")).toBeNull();
    fireEvent.change(screen.getByTestId("inbox-composer"), { target: { value: "Bom dia" } });
    expect(screen.getByTestId("salvar-resposta-rapida")).toBeVisible();
  });
});
