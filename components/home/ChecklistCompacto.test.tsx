import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChecklistCompacto } from "./ChecklistCompacto";

describe("ChecklistCompacto", () => {
  it("Continuar leva ao primeiro item que ainda falta, não à ficha da empresa", () => {
    render(
      <ChecklistCompacto
        itens={[
          { id: "empresa", label: "Dados da empresa", feito: true, href: "/app/settings/perfil" },
          { id: "whatsapp", label: "WhatsApp conectado", feito: false, href: "/app/connections" },
          { id: "ia", label: "Configurar IA", feito: false, href: "/app/settings/atendimento" },
        ]}
      />,
    );
    expect(screen.getByTestId("checklist-continuar")).toHaveAttribute("href", "/app/connections");
  });
});
