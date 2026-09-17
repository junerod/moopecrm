/**
 * Com convite válido o signup NÃO pode chamar `supabase.auth.signUp` —
 * esse é o caminho que dispara o segundo e-mail e trava em
 * "Confirme seu e-mail" quando o GoTrue não entrega.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarOuConfirmarContaConvidada } from "@/lib/auth/criar-conta-convidada";
import { signInviteToken } from "@/lib/auth/invite-token";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/criar-conta-convidada", () => ({
  criarOuConfirmarContaConvidada: vi.fn(),
}));
vi.mock("@/lib/audit", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  audit: vi.fn(async () => undefined),
}));
vi.mock("@/lib/auth/rate-limit", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  authRateLimited: vi.fn(async () => false),
}));

const signUpGoTrue = vi.fn();
const signInWithPassword = vi.fn();
const adminSentinela = { __admin: true };

function tokenPara(email: string) {
  return signInviteToken({
    invite_id: "11111111-1111-4111-8111-111111111111",
    email,
    organization_id: "22222222-2222-4222-8222-222222222222",
    role: "agent",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}

describe("signUp — convite não manda e-mail de confirmação", () => {
  beforeEach(() => {
    vi.resetModules();
    signUpGoTrue.mockReset();
    signInWithPassword.mockReset();
    vi.mocked(redirect).mockReset();
    vi.mocked(criarOuConfirmarContaConvidada).mockReset();
    vi.mocked(headers).mockResolvedValue({
      get: (k: string) => (k === "origin" ? "https://crm.exemplo.test" : null),
    } as never);
    vi.mocked(createAdminClient).mockReturnValue(adminSentinela as never);
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: signUpGoTrue, signInWithPassword },
    } as never);
  });

  it("com convite válido: confirma a conta, entra e vai ao aceite — sem signUp do GoTrue", async () => {
    const { signUp } = await import("./signUp");
    const email = "convidado@empresa.test";
    const convite = tokenPara(email);
    vi.mocked(criarOuConfirmarContaConvidada).mockResolvedValue({
      ok: true,
      userId: "u1",
      criadaAgora: true,
      jaConfirmada: true,
    });
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    });
    vi.mocked(redirect).mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });

    await expect(
      signUp(
        { email, password: "senha-nova-123", password_confirm: "senha-nova-123" },
        convite,
      ),
    ).rejects.toThrow(`REDIRECT:/team/accept-invite/${convite}`);

    expect(signUpGoTrue).not.toHaveBeenCalled();
    expect(criarOuConfirmarContaConvidada).toHaveBeenCalledWith(adminSentinela, {
      email,
      password: "senha-nova-123",
      inviteToken: convite,
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email,
      password: "senha-nova-123",
    });
  });

  it("sem convite: continua no signUp do GoTrue (e-mail de confirmação do dono)", async () => {
    const { signUp } = await import("./signUp");
    signUpGoTrue.mockResolvedValue({
      data: { user: { id: "dono" } },
      error: null,
    });

    const r = await signUp({
      org_name: "Empresa Nova",
      email: "dono@empresa.test",
      password: "senha-nova-123",
      password_confirm: "senha-nova-123",
    });

    expect(r).toEqual({ ok: true });
    expect(signUpGoTrue).toHaveBeenCalledTimes(1);
    expect(criarOuConfirmarContaConvidada).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    const opts = signUpGoTrue.mock.calls[0]?.[0] as {
      options: { emailRedirectTo: string };
    };
    expect(opts.options.emailRedirectTo).toContain("/auth/confirm?type=signup");
  });

  it("conta já confirmada e senha errada: avisa para entrar, não finge que mandou e-mail", async () => {
    const { signUp } = await import("./signUp");
    const email = "ja@empresa.test";
    const convite = tokenPara(email);
    vi.mocked(criarOuConfirmarContaConvidada).mockResolvedValue({
      ok: true,
      userId: "u2",
      criadaAgora: false,
      jaConfirmada: true,
    });
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    });

    const r = await signUp(
      { email, password: "senha-errada-123", password_confirm: "senha-errada-123" },
      convite,
    );

    expect(r).toEqual({ ok: false, error: "account_exists" });
    expect(signUpGoTrue).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});
