import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ConexaoCaidaBanner } from "@/components/app/ConexaoCaidaBanner";

afterEach(cleanup);

describe("ConexaoCaidaBanner — copy e CTA", () => {
  it("lista vazia não renderiza faixa", () => {
    const { container } = render(<ConexaoCaidaBanner caidas={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("FAILED sozinha: desconectado + Ver conexões, sem Escanear", () => {
    render(
      <ConexaoCaidaBanner
        caidas={[{ id: "1", apelido: "Vendas", status: "FAILED" }]}
      />,
    );
    expect(screen.getByRole("alert").textContent).toMatch(
      /nenhuma mensagem entra nem sai por esta conexão/,
    );
    expect(screen.getByRole("link", { name: "Ver conexões" })).toHaveAttribute(
      "href",
      "/app/connections",
    );
    expect(screen.queryByRole("link", { name: /Escanear/ })).not.toBeInTheDocument();
  });

  it("SCAN_QR_CODE sozinha: oferece Escanear o QR", () => {
    render(
      <ConexaoCaidaBanner
        caidas={[{ id: "1", apelido: "Vendas", status: "SCAN_QR_CODE" }]}
      />,
    );
    expect(screen.getByRole("link", { name: "Escanear o QR" })).toBeInTheDocument();
  });

  it("não afirma que NENHUMA mensagem entra na org inteira", () => {
    render(
      <ConexaoCaidaBanner
        caidas={[{ id: "1", apelido: "Vendas", status: "FAILED" }]}
      />,
    );
    expect(screen.getByRole("alert").textContent).not.toMatch(
      /nenhuma mensagem entra nem sai\.$/,
    );
  });
});
