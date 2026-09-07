/**
 * Simple Mode: a escolha de IA_MODE não publica agente.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const escolherModo = vi.fn<(fd: FormData) => Promise<{ ok: true }>>();
escolherModo.mockResolvedValue({ ok: true });
const skipAi = vi.fn();
vi.mock("@/app/actions/onboarding/escolherModoDaIa", () => ({
  escolherModoDaIa: (fd: FormData) => escolherModo(fd),
}));
vi.mock("@/app/actions/onboarding/createDefaultAgent", () => ({
  createDefaultAgent: vi.fn(),
  skipAi: () => skipAi(),
}));
vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { SetupAiForm } from "@/app/onboarding/setup-ai/_form";

afterEach(() => {
  cleanup();
  escolherModo.mockClear();
  skipAi.mockClear();
});

describe("setup de IA no Simple Mode", () => {
  it("grava o modo e não cria agente", async () => {
    render(<SetupAiForm />);
    fireEvent.click(screen.getByLabelText(/Assistente IA/i));
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(await screen.findByRole("button", { name: /continuar/i })).toBeInTheDocument();
    expect(escolherModo).toHaveBeenCalled();
    const fd = escolherModo.mock.calls[0]?.[0];
    expect(fd?.get("ai_mode")).toBe("copilot");
  });

  it("as quatro opções existem em linguagem simples", () => {
    render(<SetupAiForm />);
    expect(screen.getByText("Sem IA")).toBeInTheDocument();
    expect(screen.getByText("Assistente IA")).toBeInTheDocument();
    expect(screen.getByText("IA controlada")).toBeInTheDocument();
    expect(screen.getByText("Atendimento automático")).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma destas opções publica um agente/i)).toBeInTheDocument();
  });
});
