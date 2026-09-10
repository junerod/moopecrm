import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AiModeForm } from "@/app/app/settings/atendimento/_ai-mode";

const get = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiClient: {
    get: (...a: unknown[]) => get(...a),
    patch: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("TESTE 11 — UI mostra efetivo OFF com motivo", () => {
  it("GLOBAL OFF + tenant AUTONOMOUS", async () => {
    get.mockResolvedValue({
      data: {
        configured: "autonomous",
        effective: "off",
        kill_global: true,
        reason: "GLOBAL AI_EXECUTION=off — nenhuma IA conversacional executa.",
        agent_published: true,
        action_policy: { allow: [], confirm: [] },
      },
    });

    render(<AiModeForm initial={{ configured: "autonomous" }} />);

    await waitFor(() => expect(screen.getByTestId("ai-mode-valor-efetivo").textContent).toBe("Desligada"));
    expect(screen.getByTestId("ai-mode-configurado").textContent).toBe("Automática");
    expect(screen.getByTestId("ai-mode-motivo").textContent).toMatch(/IA desativada globalmente/i);
  });
});
