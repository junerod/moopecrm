import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/channels/useDirectChannel", () => ({
  useDirectChannel: vi.fn(),
  useConnectDirectChannel: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import { useDirectChannel } from "@/hooks/channels/useDirectChannel";

import { CanalDirectClient } from "./CanalDirectClient";

describe("CanalDirectClient", () => {
  it("sem o app pronto — mostra a porta e não oferece conectar", () => {
    vi.mocked(useDirectChannel).mockReturnValue({
      data: {
        data: {
          connected: false,
          podeReceber: false,
          hasToken: false,
          accountId: null,
          displayName: null,
          status: null,
          webhook: null,
        },
      },
      isPending: false,
    } as never);
    render(<CanalDirectClient />);
    expect(screen.getByTestId("canal-direct")).toBeInTheDocument();
    expect(screen.getByTestId("direct-proximo-passo")).toBeInTheDocument();
    expect(screen.getByTestId("instagram-ajuda")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /conectar/i })).toBeNull();
  });

  it("com o app pronto — oferece conectar", () => {
    vi.mocked(useDirectChannel).mockReturnValue({
      data: {
        data: {
          connected: false,
          podeReceber: true,
          hasToken: false,
          accountId: null,
          displayName: null,
          status: null,
          webhook: null,
        },
      },
      isPending: false,
    } as never);
    render(<CanalDirectClient />);
    expect(screen.getByTestId("direct-conectar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conectar instagram/i })).toBeTruthy();
    expect(screen.getByTestId("instagram-ajuda")).toBeInTheDocument();
  });
});
