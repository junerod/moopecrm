import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandingAssistentes } from "./LandingAssistentes";

describe("LandingAssistentes", () => {
  it("mostra o próximo passo quando o assistente ainda não publica", () => {
    render(
      <LandingAssistentes
        packAtivo={false}
        packLabel={null}
        cards={[
          {
            id: "ag-1",
            name: "Recepção",
            description: "Recebe o cliente",
            ativo: false,
            specialtyKey: "recepcao",
            principal: true,
            jaExistia: false,
          },
        ]}
        canWrite
      />,
    );
    expect(screen.getByTestId("proximo-passo")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Publicar" })).toHaveAttribute(
      "href",
      "/app/ai/agents/ag-1",
    );
  });
});
