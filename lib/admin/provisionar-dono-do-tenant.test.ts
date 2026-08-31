import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/email/resend", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/branding/saida", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/branding/saida")>();
  return {
    ...actual,
    marcaDaSaida: vi.fn(async () => ({
      nome: "MOOPE CRM",
      accent: "#111",
      accentFg: "#fff",
      logoUrl: null,
    })),
  };
});
vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_APP_URL: "https://crm.exemplo.com" },
}));

import { sendEmail } from "@/lib/email/resend";
import { provisionarDonoDoTenant } from "@/lib/admin/provisionar-dono-do-tenant";

function adminNovoUsuario() {
  const inserts: unknown[] = [];
  return {
    inserts,
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({ data: { users: [] }, error: null })),
        createUser: vi.fn(async () => ({
          data: { user: { id: "user-novo" } },
          error: null,
        })),
        generateLink: vi.fn(async () => ({
          data: { properties: { action_link: "https://crm.exemplo.com/definir" } },
          error: null,
        })),
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
      insert: (row: unknown) => {
        inserts.push(row);
        return Promise.resolve({ error: null });
      },
      update: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    }),
  };
}

describe("provisionar dono do tenant", () => {
  beforeEach(() => {
    vi.mocked(sendEmail).mockClear();
  });

  it("usuário novo com senha: cria, associa e manda a senha no e-mail", async () => {
    const db = adminNovoUsuario();
    const r = await provisionarDonoDoTenant(db as never, {
      orgId: "org-1",
      orgName: "Locadora Norte",
      email: "dono@locadora.com",
      senha: "SenhaForte1",
    });
    expect(r.criadoAgora).toBe(true);
    expect(r.senhaDefinidaAqui).toBe(true);
    expect(r.emailEnviado).toBe(true);
    expect(db.auth.admin.generateLink).not.toHaveBeenCalled();
    expect(db.inserts[0]).toMatchObject({
      user_id: "user-novo",
      organization_id: "org-1",
      role: "admin",
    });
    expect(vi.mocked(sendEmail)).toHaveBeenCalledOnce();
    const payload = vi.mocked(sendEmail).mock.calls[0]![0];
    expect(payload.to).toBe("dono@locadora.com");
    expect(payload.text).toContain("SenhaForte1");
  });

  it("usuário novo sem senha: manda link de criar senha, não inventa senha no e-mail", async () => {
    const db = adminNovoUsuario();
    const r = await provisionarDonoDoTenant(db as never, {
      orgId: "org-1",
      orgName: "Locadora Norte",
      email: "dono@locadora.com",
    });
    expect(r.senhaDefinidaAqui).toBe(false);
    expect(db.auth.admin.generateLink).toHaveBeenCalledOnce();
    const payload = vi.mocked(sendEmail).mock.calls[0]![0];
    expect(payload.text).toContain("Criar sua senha");
    expect(payload.text).not.toMatch(/Senha inicial/);
  });
});
