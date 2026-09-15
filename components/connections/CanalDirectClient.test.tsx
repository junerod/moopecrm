import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/channels/useDirectChannel", () => ({
  useDirectChannel: vi.fn(),
  useConnectDirectChannel: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { useDirectChannel } from "@/hooks/channels/useDirectChannel";

import { CanalDirectClient } from "./CanalDirectClient";

function estado(parcial: Record<string, unknown>) {
  return {
    data: {
      data: {
        connected: false,
        podeReceber: false,
        podeConectarComoApp: false,
        hasToken: false,
        accountId: null,
        displayName: null,
        status: null,
        webhook: null,
        ...parcial,
      },
    },
    isPending: false,
  } as never;
}

describe("CanalDirectClient", () => {
  it("sem o app pronto — mostra a porta e não oferece conectar", () => {
    vi.mocked(useDirectChannel).mockReturnValue(estado({}));
    render(<CanalDirectClient />);
    expect(screen.getByTestId("canal-direct")).toBeInTheDocument();
    expect(screen.getByTestId("direct-proximo-passo")).toBeInTheDocument();
    expect(screen.getByTestId("instagram-ajuda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /conectar instagram/i })).toBeNull();
    expect(screen.queryByTestId("instagram-continuar")).toBeNull();
  });

  it("com o app pronto — oferece conectar", () => {
    vi.mocked(useDirectChannel).mockReturnValue(estado({ podeReceber: true }));
    render(<CanalDirectClient />);
    expect(screen.getByTestId("direct-conectar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conectar instagram/i })).toBeTruthy();
    expect(screen.getByTestId("instagram-ajuda")).toBeInTheDocument();
  });

  it("quando a instalação é um app — oferece Continuar com Instagram", () => {
    vi.mocked(useDirectChannel).mockReturnValue(estado({ podeConectarComoApp: true }));
    render(<CanalDirectClient />);
    expect(screen.getByTestId("instagram-continuar")).toHaveAttribute(
      "href",
      "/api/v1/channels/direct/oauth",
    );
  });
});
