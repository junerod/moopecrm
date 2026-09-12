import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ConversationListItem } from "@/components/inbox/ConversationListItem";
import { SeloDaPessoa } from "@/components/inbox/SeloDaPessoa";
import type { ConversationWithContact } from "@/hooks/inbox/useConversationsRealtime";

const contato = {
  id: "ct1",
  display_name: "Ricardo Salvador",
  name: null,
  phone_number: "+595999",
  tags: ["plataforma"],
  is_blocked: false,
  is_anonymized: false,
  source_metadata: { notify_name: "Ricardo Salvador" },
  papel: "cliente" as const,
};

const conversa = {
  id: "c1",
  organization_id: "org",
  contact_id: "ct1",
  channel_session_id: "s1",
  channel: "whatsapp",
  status: "open",
  last_message_at: new Date().toISOString(),
  last_message_preview: "olá",
  unread_count_for_assignee: 0,
  created_at: new Date().toISOString(),
  tags: ["rastreamento"],
  contacts: contato,
} as unknown as ConversationWithContact;

describe("SeloDaPessoa colorido", () => {
  it("não salvo continua com o texto e o data-selo que o e2e lê", () => {
    render(<SeloDaPessoa contact={contato} />);
    const selo = screen.getByTestId("selo-da-pessoa");
    expect(selo).toHaveAttribute("data-selo", "nao_salvo");
    expect(selo).toHaveTextContent("Nome do WhatsApp · não salvo");
  });

  it("cliente salvo pinta o chip de cliente, não o de não-salvo", () => {
    render(<SeloDaPessoa contact={{ ...contato, name: "Ricardo Salvador" }} />);
    expect(screen.getByTestId("selo-da-pessoa")).toHaveAttribute("data-selo", "cliente");
    expect(screen.getByText("Cliente")).toBeInTheDocument();
  });
});

describe("lista do inbox — zebra e tags reutilizadas", () => {
  it("linha ímpar recebe o fundo alternado", () => {
    const { container } = render(
      <ConversationListItem
        conversation={conversa}
        isSelected={false}
        onSelect={() => {}}
        zebraImpar
      />,
    );
    expect(container.querySelector("button")?.className).toMatch(/inbox-row-alt/);
  });

  it("mostra tags do contato e da conversa, sem repetir", () => {
    render(
      <ConversationListItem
        conversation={conversa}
        isSelected={false}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("plataforma")).toBeInTheDocument();
    expect(screen.getByText("rastreamento")).toBeInTheDocument();
  });
});
