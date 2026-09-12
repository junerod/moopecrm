import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PerfilDoNegocioForm } from "@/app/app/settings/perfil/_client";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/app/actions/settings/aplicarPerfil", () => ({
  aplicarPerfilAction: vi.fn(),
}));

describe("troca de Ready Model", () => {
  it("Advocacia → Comercial pede confirmação e não apaga Processos", async () => {
    const user = userEvent.setup();
    render(
      <PerfilDoNegocioForm
        atual="advocacia"
        funisExistentes={[
          { id: "1", name: "Novos clientes" },
          { id: "2", name: "Processos" },
        ]}
      />,
    );
    await user.click(screen.getByLabelText(/Comercial \/ Vendas/));
    await user.click(screen.getByTestId("aplicar-perfil"));
    expect(screen.getByTestId("confirmar-troca-de-perfil")).toHaveTextContent(
      "Seu perfil agora é Comercial / Vendas",
    );
    expect(screen.getByTestId("confirmar-troca-de-perfil")).toHaveTextContent("Processos");
    expect(screen.getByTestId("confirmar-troca-de-perfil")).toHaveTextContent("serão mantidos");
    expect(screen.getByTestId("aplicar-perfil")).toHaveTextContent("Criar funil Vendas");
  });

  it("quando o funil do modelo já existe, diz isso", async () => {
    const user = userEvent.setup();
    render(
      <PerfilDoNegocioForm
        atual="advocacia"
        funisExistentes={[{ id: "1", name: "Vendas" }]}
      />,
    );
    await user.click(screen.getByLabelText(/Comercial \/ Vendas/));
    await user.click(screen.getByTestId("aplicar-perfil"));
    expect(screen.getByTestId("confirmar-troca-de-perfil")).toHaveTextContent(
      "Funil Vendas já existe",
    );
  });
});
