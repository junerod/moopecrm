import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { HealthGrid } from "@/components/admin/tenants/HealthGrid";
import type { TenantHealthResponse } from "@/app/api/v1/admin/tenants/[id]/health/route";

const SAUDE: TenantHealthResponse = {
  waha: { sessions: [], overall_status: "warning" },
  nuvemshop: {
    connected: false,
    expires_at: null,
    last_synced_at: null,
    days_until_expiry: null,
    status: "warning",
  },
  ai: {
    consumed_cents: 0,
    budget_cents: null,
    percent_used: null,
    enforcement_mode: "off",
    status: "ok",
  },
  audit: { last_at: null, lag_seconds: null, status: "warning" },
};

describe("HealthGrid — o que o admin lê", () => {
  it("mostra WhatsApp e não fala de loja", () => {
    render(<HealthGrid health={SAUDE} />);
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/nuvemshop/i);
    expect(document.body.textContent).not.toMatch(/WAHA/);
  });
});
