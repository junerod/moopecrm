import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PlatformModeBanner } from "./PlatformModeBanner";
import { SaidaDaPlataforma } from "./SaidaDaPlataforma";

afterEach(cleanup);

describe("SaidaDaPlataforma", () => {
  it("modo plataforma oferece CRM pessoal e logout — sem link que devolve ao dashboard", () => {
    render(<PlatformModeBanner />);
    expect(screen.getByTestId("admin-usar-crm")).toBeInTheDocument();
    expect(screen.getByTestId("admin-sair")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /sair pra app pessoal/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /\/app$/i })).toBeNull();
  });

  it("as duas portas existem em qualquer variante", () => {
    render(<SaidaDaPlataforma variante="pagina" />);
    expect(screen.getAllByTestId("admin-usar-crm").length).toBeGreaterThan(0);
    expect(screen.getAllByTestId("admin-sair").length).toBeGreaterThan(0);
  });
});
