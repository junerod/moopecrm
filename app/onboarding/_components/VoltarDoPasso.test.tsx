import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VoltarDoPasso } from "./VoltarDoPasso";

describe("VoltarDoPasso", () => {
  it("no primeiro passo não oferece volta", () => {
    const { container } = render(<VoltarDoPasso segmento="welcome" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("no passo 5 (testar) volta para o funil, ao lado de quem chamar", () => {
    render(<VoltarDoPasso segmento="testar" />);
    expect(screen.getByRole("link", { name: /voltar/i })).toHaveAttribute(
      "href",
      "/onboarding/funil",
    );
  });

  it("no funil volta para o agente de IA", () => {
    render(<VoltarDoPasso segmento="funil" />);
    expect(screen.getByRole("link", { name: /voltar/i })).toHaveAttribute(
      "href",
      "/onboarding/setup-ai",
    );
  });
});
