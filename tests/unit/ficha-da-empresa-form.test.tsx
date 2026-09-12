import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FichaDaEmpresaForm } from "@/app/app/settings/business/_ficha";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

afterEach(cleanup);

describe("FichaDaEmpresaForm", () => {
  it("admin vê campos e Salvar; manager não", () => {
    const { rerender } = render(
      <FichaDaEmpresaForm
        displayName="Rodrigues Advogados"
        legalName="Rodrigues Advogados"
        cnpj={null}
        contato={{ telefone: null, site: null, endereco: null }}
        modeloRotulo="Comercial / Vendas"
        subtipo={null}
        podeEditar
      />,
    );
    expect(screen.getByRole("heading", { name: "Meu Negócio" })).toBeInTheDocument();
    expect(screen.getByTestId("negocio-empresa")).toHaveValue("Rodrigues Advogados");
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Trocar senha" })).toHaveAttribute(
      "href",
      "/app/settings/profile",
    );

    rerender(
      <FichaDaEmpresaForm
        displayName="Rodrigues Advogados"
        legalName="Rodrigues Advogados"
        cnpj={null}
        contato={{ telefone: null, site: null, endereco: null }}
        modeloRotulo="Comercial / Vendas"
        subtipo={null}
        podeEditar={false}
      />,
    );
    expect(screen.queryByRole("button", { name: "Salvar" })).not.toBeInTheDocument();
    expect(screen.getByText(/Peça a um admin/)).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do negócio")).toBeDisabled();
  });
});
