/**
 * O convite já prova o e-mail. Esta função NÃO pode cair no `signUp` do
 * GoTrue — é ele que dispara o segundo e-mail e deixa a pessoa presa em
 * "Confirme seu e-mail" quando o correio do Auth não entrega.
 */
import { describe, expect, it, vi } from "vitest";

import { criarOuConfirmarContaConvidada } from "@/lib/auth/criar-conta-convidada";

function adminMock(opts: {
  users?: Array<{
    id: string;
    email: string;
    email_confirmed_at?: string | null;
    user_metadata?: Record<string, unknown>;
  }>;
  createError?: { message: string } | null;
  createdId?: string;
  updateError?: { message: string } | null;
}) {
  const listUsers = vi.fn(async () => ({
    data: { users: opts.users ?? [] },
    error: null,
  }));
  const createUser = vi.fn(async () => ({
    data: opts.createError ? { user: null } : { user: { id: opts.createdId ?? "novo" } },
    error: opts.createError ?? null,
  }));
  const updateUserById = vi.fn(async () => ({
    data: { user: { id: "existente" } },
    error: opts.updateError ?? null,
  }));
  return {
    auth: { admin: { listUsers, createUser, updateUserById } },
    spies: { listUsers, createUser, updateUserById },
  };
}

describe("criarOuConfirmarContaConvidada", () => {
  it("conta nova nasce com e-mail já confirmado — sem passar pelo signUp do GoTrue", async () => {
    const { auth, spies } = adminMock({ createdId: "u-nova" });
    const r = await criarOuConfirmarContaConvidada({ auth } as never, {
      email: "  Convidado@Empresa.Test ",
      password: "senha-nova-123",
      inviteToken: "token.hmac",
    });

    expect(r).toEqual({
      ok: true,
      userId: "u-nova",
      criadaAgora: true,
      jaConfirmada: true,
    });
    expect(spies.createUser).toHaveBeenCalledWith({
      email: "convidado@empresa.test",
      password: "senha-nova-123",
      email_confirm: true,
      user_metadata: { invite_token: "token.hmac" },
    });
    expect(spies.updateUserById).not.toHaveBeenCalled();
  });

  it("conta travada no meio (ainda sem confirmar) recebe a senha e confirma — sem segundo e-mail", async () => {
    const { auth, spies } = adminMock({
      users: [
        {
          id: "u-pendente",
          email: "solutt@empresa.test",
          email_confirmed_at: null,
          user_metadata: { invite_token: "antigo" },
        },
      ],
    });
    const r = await criarOuConfirmarContaConvidada({ auth } as never, {
      email: "solutt@empresa.test",
      password: "outra-senha-123",
      inviteToken: "token.novo",
    });

    expect(r).toEqual({
      ok: true,
      userId: "u-pendente",
      criadaAgora: false,
      jaConfirmada: true,
    });
    expect(spies.createUser).not.toHaveBeenCalled();
    expect(spies.updateUserById).toHaveBeenCalledWith("u-pendente", {
      password: "outra-senha-123",
      email_confirm: true,
      user_metadata: { invite_token: "token.novo" },
    });
  });

  it("conta já confirmada NÃO tem a senha resetada — quem chama tenta entrar", async () => {
    const { auth, spies } = adminMock({
      users: [
        {
          id: "u-pronta",
          email: "ja@empresa.test",
          email_confirmed_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    const r = await criarOuConfirmarContaConvidada({ auth } as never, {
      email: "ja@empresa.test",
      password: "senha-que-nao-vale",
      inviteToken: "token.hmac",
    });

    expect(r).toEqual({
      ok: true,
      userId: "u-pronta",
      criadaAgora: false,
      jaConfirmada: true,
    });
    expect(spies.createUser).not.toHaveBeenCalled();
    expect(spies.updateUserById).not.toHaveBeenCalled();
  });

  it("createUser falha e ninguém aparece na lista: falha fechada, sem fingir sucesso", async () => {
    const { auth, spies } = adminMock({
      createError: { message: "create failed" },
    });
    const r = await criarOuConfirmarContaConvidada({ auth } as never, {
      email: "x@empresa.test",
      password: "senha-nova-123",
      inviteToken: "token.hmac",
    });
    expect(r).toEqual({ ok: false, motivo: "falha_criar" });
    expect(spies.createUser).toHaveBeenCalled();
  });
});
