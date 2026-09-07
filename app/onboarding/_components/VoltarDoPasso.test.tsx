import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { VoltarDoPasso } from "./VoltarDoPasso";

describe("VoltarDoPasso", () => {
  it("no primeiro passo não oferece volta", () => {
    const { container } = render(<VoltarDoPasso segmento="welcome" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("no funil volta para quem atende", () => {
    render(<VoltarDoPasso segmento="funil" />);
    expect(screen.getByRole("link", { name: /voltar/i })).toHaveAttribute(
      "href",
      "/onboarding/quem-atende",
    );
  });

  it("na IA volta para o lembrete", () => {
    render(<VoltarDoPasso segmento="setup-ai" />);
    expect(screen.getByRole("link", { name: /voltar/i })).toHaveAttribute(
      "href",
      "/onboarding/follow-up",
    );
  });
});
