import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.fn();
const updateUser = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn(),
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  AUTH_LIMITS: { password_change: { ip: 20, id: 5, windowSec: 300 } },
  authRateLimited: vi.fn(async () => false),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword: signIn, updateUser },
  })),
}));
vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => undefined),
}));

import { loadAuthUser } from "@/lib/auth/server";
import { alterarSenhaDaConta } from "@/app/actions/settings/alterarSenhaDaConta";
import { changePasswordSchema } from "@/lib/auth/schemas";

describe("changePasswordSchema", () => {
  it("senha curta ou igual à atual não passa", () => {
    expect(
      changePasswordSchema.safeParse({
        current_password: "atual1234",
        password: "curta",
        password_confirm: "curta",
      }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        current_password: "igual1234",
        password: "igual1234",
        password_confirm: "igual1234",
      }).success,
    ).toBe(false);
  });
});

describe("alterarSenhaDaConta", () => {
  beforeEach(() => {
    signIn.mockReset();
    updateUser.mockReset();
    vi.mocked(loadAuthUser).mockResolvedValue({
      id: "u1",
      email: "a@ex.com",
      full_name: null,
      avatar_url: null,
      is_platform_admin: false,
    });
  });

  it("payload inválido não chama o provedor", async () => {
    const r = await alterarSenhaDaConta({
      current_password: "x",
      password: "curta",
      password_confirm: "outra",
    });
    expect(r).toEqual({ ok: false, error: "validation_failed" });
    expect(signIn).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("senha atual errada não troca", async () => {
    signIn.mockResolvedValue({ error: { message: "Invalid" } });
    const r = await alterarSenhaDaConta({
      current_password: "errada123",
      password: "nova-senha-ok",
      password_confirm: "nova-senha-ok",
    });
    expect(r).toEqual({ ok: false, error: "wrong_password" });
    expect(updateUser).not.toHaveBeenCalled();
  });
});
