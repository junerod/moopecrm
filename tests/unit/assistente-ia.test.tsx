import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssistenteIa } from "@/components/inbox/AssistenteIa";

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...a: unknown[]) => get(...a),
    post: (...a: unknown[]) => post(...a),
    patch: (...a: unknown[]) => patch(...a),
  },
}));

const SUGESTAO = {
  id: "sug-1",
  inbound_message_id: "msg-1",
  summary: "Cliente perguntou preço.",
  intent: "PRICE",
  intent_label: "Preço",
  suggested_reply: "Posso te enviar a tabela.",
  suggested_next_action: null,
  confidence_band: "alta",
  status: "ready",
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  patch.mockReset();
  get.mockImplementation((path: unknown) => {
    const p = String(path);
    if (p.includes("/copilot")) return Promise.resolve({ data: { suggestion: SUGESTAO } });
    return Promise.resolve({ data: { requests: [] } });
  });
  patch.mockResolvedValue({ data: { suggestion: { ...SUGESTAO, status: "used" } } });
});

describe("TESTE 4 — USAR RESPOSTA preenche o composer e não envia", () => {
  it("chama onUsarResposta com o texto e só marca a sugestão", async () => {
    const onUsar = vi.fn();
    render(<AssistenteIa conversationId="conv-1" onUsarResposta={onUsar} />);

    await screen.findByTestId("assistente-resposta");
    await userEvent.click(screen.getByTestId("assistente-usar"));

    expect(onUsar).toHaveBeenCalledWith("Posso te enviar a tabela.");
    await waitFor(() => expect(patch).toHaveBeenCalled());
    const [rota] = patch.mock.calls[0] as [string, { op: string }];
    expect(rota).toContain("/copilot");
    expect(post).not.toHaveBeenCalled();
  });
});

describe("TESTE 1 na UI — OFF não mostra sugestão pronta", () => {
  it("sem suggestion, não há resposta sugerida", async () => {
    get.mockImplementation((path: unknown) => {
      const p = String(path);
      if (p.includes("/copilot")) return Promise.resolve({ data: { suggestion: null } });
      return Promise.resolve({ data: { requests: [] } });
    });
    render(<AssistenteIa conversationId="conv-1" />);
    await screen.findByTestId("assistente-gerar");
    expect(screen.queryByTestId("assistente-resposta")).toBeNull();
  });
});
