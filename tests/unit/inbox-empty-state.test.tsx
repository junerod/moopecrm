import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InboxEmptyState } from "@/components/inbox/InboxEmptyState";

describe("InboxEmptyState", () => {
  it("mantém o texto que os e2e casam no fio vazio", () => {
    render(<InboxEmptyState variante="thread" />);
    expect(screen.getByText("Selecione uma conversa")).toBeInTheDocument();
    expect(screen.getByTestId("inbox-empty-thread")).toBeInTheDocument();
  });

  it("ficha vazia explica o painel sem ilustração gigante", () => {
    render(<InboxEmptyState variante="ficha" />);
    expect(
      screen.getByText("Os dados do contato e da oportunidade aparecerão aqui."),
    ).toBeInTheDocument();
  });
});
