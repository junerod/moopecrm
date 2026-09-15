import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { agregarMetricas, aplicarDesfecho } from "@/lib/campanhas/metricas";

import { CompararCampanhas } from "./comparar";

describe("CompararCampanhas", () => {
  it("não trata resposta como sucesso — ganho e receita aparecem", () => {
    const a = aplicarDesfecho(agregarMetricas([{ status: "replied", lead_id: "1" }]), {
      ganhos: 1,
      perdidos: 4,
      valor_ganho_cents: 640000,
    });
    const b = aplicarDesfecho(agregarMetricas([{ status: "replied", lead_id: "2" }]), {
      ganhos: 4,
      perdidos: 1,
      valor_ganho_cents: 1890000,
    });
    render(
      <CompararCampanhas nomeA="Reativação" nomeB="Bastidores" a={a} b={b} />,
    );
    expect(screen.getByTestId("campanhas-comparar")).toHaveTextContent("Ganhos");
    expect(screen.getByTestId("campanhas-comparar")).toHaveTextContent("Receita ganha");
    expect(screen.getByTestId("campanhas-comparar")).toHaveTextContent("Reativação");
    expect(screen.getByTestId("campanhas-comparar")).toHaveTextContent("Bastidores");
  });
});
