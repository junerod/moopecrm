import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserById = vi.fn();
const updateUserById = vi.fn();
const maybeSingle = vi.fn();

vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => undefined),
}));

import { audit } from "@/lib/audit";
import { definirSenhaDeMembro } from "@/lib/auth/definir-senha-de-membro";
import { definirSenhaDeMembroSchema } from "@/lib/auth/schemas";

function adminComMembro(membro: { user_id: string; revoked_at: string | null } | null) {
  maybeSingle.mockResolvedValue({ data: membro, error: null });
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    }),
    auth: { admin: { getUserById, updateUserById } },
  } as never;
}

describe("definirSenhaDeMembroSchema", () => {
  it("recusa senha curta ou confirmação diferente", () => {
    expect(
      definirSenhaDeMembroSchema.safeParse({
        password: "curta",
        password_confirm: "curta",
      }).success,
    ).toBe(false);
    expect(
      definirSenhaDeMembroSchema.safeParse({
        password: "senha-ok-12",
        password_confirm: "outra-senha",
      }).success,
    ).toBe(false);
  });
});

describe("definirSenhaDeMembro", () => {
  beforeEach(() => {
    vi.mocked(audit).mockClear();
    getUserById.mockReset();
    updateUserById.mockReset();
    maybeSingle.mockReset();
  });

  it("ninguém define a própria senha por aqui — isso é Segurança", async () => {
    const r = await definirSenhaDeMembro(adminComMembro({ user_id: "u1", revoked_at: null }), {
      organizationId: "org",
      targetUserId: "u1",
      actorUserId: "u1",
      password: "nova-senha-ok",
      origem: "tenant",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("state_conflict");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("membro de outro tenant ou revogado não recebe senha", async () => {
    const r = await definirSenhaDeMembro(adminComMembro(null), {
      organizationId: "org",
      targetUserId: "u2",
      actorUserId: "admin",
      password: "nova-senha-ok",
      origem: "platform",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("not_found");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("grava a senha, marca troca no próximo login, e o audit NÃO leva a senha", async () => {
    getUserById.mockResolvedValue({
      data: { user: { id: "u2", app_metadata: { foo: 1 } } },
      error: null,
    });
    updateUserById.mockResolvedValue({ data: {}, error: null });
    const r = await definirSenhaDeMembro(adminComMembro({ user_id: "u2", revoked_at: null }), {
      organizationId: "org",
      targetUserId: "u2",
      actorUserId: "admin",
      password: "nova-senha-secreta",
      origem: "platform",
      requestId: "req-1",
    });
    expect(r).toEqual({ ok: true });
    expect(updateUserById).toHaveBeenCalledWith("u2", {
      password: "nova-senha-secreta",
      app_metadata: { foo: 1, must_change_password: true },
    });
    expect(vi.mocked(audit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.password_set_by_admin",
        resourceId: "u2",
        metadata: { origem: "platform" },
      }),
    );
    const meta = vi.mocked(audit).mock.calls[0]?.[0]?.metadata ?? {};
    expect(JSON.stringify(meta)).not.toMatch(/nova-senha-secreta/);
  });
});
