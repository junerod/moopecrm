import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import type { AdminTenantRow } from "@/hooks/useAdminTenants";

import { TenantsTable } from "./TenantsTable";

const TENANT: AdminTenantRow = {
  id: "8f4b9d4d-e9a2-49ff-8e48-b5001b3fae88",
  slug: "teste-local",
  display_name: "MOOPE Tecnologia",
  legal_name: "MOOPE Tecnologia",
  cnpj: null,
  status: "active",
  onboarded_at: "2026-08-28T00:00:00.000Z",
  suspended_at: null,
  created_at: "2026-08-28T00:00:00.000Z",
  user_count: [{ count: 4 }],
  conversations_count: [{ count: 7 }],
};

describe("TenantsTable — suporte na lista", () => {
  it("oferece Impersonar na linha, sem abrir o detalhe antes", () => {
    render(
      <TenantsTable
        data={[TENANT]}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => undefined}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Impersonar MOOPE Tecnologia" }),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver" })).toHaveAttribute(
      "href",
      `/admin/tenants/${TENANT.id}`,
    );
  });

  it("não deixa impersonar tenant redigido", () => {
    render(
      <TenantsTable
        data={[{ ...TENANT, status: "redacted" }]}
        hasNextPage={false}
        isFetchingNextPage={false}
        onLoadMore={() => undefined}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Tenant redigido — ação não disponível" }),
    ).toBeDisabled();
  });
});
