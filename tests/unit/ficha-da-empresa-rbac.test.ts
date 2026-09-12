import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: vi.fn(),
  resolveActiveOrg: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({
  audit: vi.fn(async () => undefined),
}));

import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateFichaDaEmpresa } from "@/app/actions/settings/updateFichaDaEmpresa";

const FICHA = {
  display_name: "Moope",
  legal_name: "Moope Tecnologia",
  cnpj: null,
  empresa: { telefone: null, site: null, endereco: null },
};

describe("updateFichaDaEmpresa — só admin grava", () => {
  beforeEach(() => {
    vi.mocked(loadAuthUser).mockReset();
    vi.mocked(resolveActiveOrg).mockReset();
    vi.mocked(createAdminClient).mockReset();
  });

  it("manager não grava", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue({
      id: "u1",
      email: "g@ex.com",
      full_name: null,
      avatar_url: null,
      is_platform_admin: false,
    });
    vi.mocked(resolveActiveOrg).mockResolvedValue({
      orgId: "o1",
      name: "Org",
      role: "manager",
    } as never);

    const r = await updateFichaDaEmpresa(FICHA);
    expect(r).toEqual({ ok: false, error: "forbidden_role" });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
