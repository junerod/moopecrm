import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserMenu } from "@/components/shell/UserMenu";
import type { AuthUser } from "@/lib/auth/types";

const userRef: { current: Pick<AuthUser, "email" | "full_name" | "avatar_url" | "is_platform_admin"> } = {
  current: {
    email: "dono@exemplo.com",
    full_name: "Dono",
    avatar_url: null,
    is_platform_admin: false,
  },
};

vi.mock("@/hooks/auth/AuthProvider", () => ({
  useUser: () => userRef.current,
  useAuth: () => ({ signOut: vi.fn() }),
}));

afterEach(cleanup);

describe("UserMenu — porta da plataforma", () => {
  it("admin da empresa não vê o atalho nem o selo", () => {
    userRef.current.is_platform_admin = false;
    render(<UserMenu />);
    expect(screen.queryByText("Dono do servidor")).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Admin da plataforma/ })).toBeNull();
  });

  it("o dono do servidor vê o selo e o atalho", async () => {
    userRef.current.is_platform_admin = true;
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole("button", { name: "Menu do usuário" }));
    expect(await screen.findByText("Dono do servidor")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Admin da plataforma/ })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
