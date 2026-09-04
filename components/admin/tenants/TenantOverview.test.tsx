/**
 * TenantOverview — o que o admin de plataforma lê sobre um tenant.
 *
 * Guarda o que a tela NÃO pode voltar a mostrar: loja, pedidos, traço no
 * lugar de campo vazio, data numérica sem o mês, janela de 30 dias no lugar
 * do mês corrente.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import type { TenantCounts, TenantOrganization } from "@/hooks/useTenantDetail";

import { TenantOverview } from "./TenantOverview";

const ORG: TenantOrganization = {
  id: "33333333-3333-4333-8333-333333333333",
  slug: "acme",
  display_name: "Acme",
  legal_name: "Acme Comércio LTDA",
  cnpj: "00.000.000/0001-00",
  status: "active",
  onboarded_at: "2026-08-31T12:24:00.000Z",
  suspended_at: null,
  created_at: "2026-08-31T12:24:00.000Z",
  settings: { plan: "pro" },
};

const COUNTS: TenantCounts = {
  user_count: 3,
  conversations_count: 10,
  messages_count: 100,
  leads_count: 5,
  lgpd_requests_pending: 0,
  ai_invocations_do_mes: 42,
  whatsapp_sessions_count: 4,
  whatsapp_sessions_working: 1,
};

function renderizar(
  org: Partial<TenantOrganization> = {},
  counts: Partial<TenantCounts> = {},
) {
  return render(
    <TenantOverview
      organization={{ ...ORG, ...org }}
      counts={{ ...COUNTS, ...counts }}
    />,
  );
}

describe("TenantOverview — ficha do tenant", () => {
  it("mostra o mês por extenso na data de entrada e no onboarding", () => {
    renderizar();
    const datas = screen.getAllByText(/31 de agosto de 2026/);
    expect(datas.length).toBeGreaterThanOrEqual(2);
    expect(document.body.textContent).not.toMatch(/31\/08/);
  });

  it("mostra CNPJ e plano quando o tenant tem os dois", () => {
    renderizar();
    expect(screen.getByText("CNPJ")).toBeInTheDocument();
    expect(screen.getByText("00.000.000/0001-00")).toBeInTheDocument();
    expect(screen.getByText("Plano")).toBeInTheDocument();
    expect(screen.getByText("pro")).toBeInTheDocument();
  });

  it("esconde CNPJ e plano quando o cadastro não tem", () => {
    renderizar({ cnpj: null, settings: {} });
    expect(screen.queryByText("CNPJ")).not.toBeInTheDocument();
    expect(screen.queryByText("Plano")).not.toBeInTheDocument();
  });

  it("não mostra traço no lugar de campo vazio", () => {
    renderizar({ cnpj: null, settings: { plan: "—" } });
    expect(document.body.textContent).not.toMatch(/—/);
  });

  it("WhatsApp conta as sessões conectadas, sem nome de transporte", () => {
    renderizar();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("1 de 4 conectadas")).toBeInTheDocument();
  });

  it("invocações de IA são do mês, não de uma janela de 30 dias", () => {
    renderizar();
    expect(screen.getByText(/Invocações de IA em /i)).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/30d/i);
  });

  it("não fala de loja nem de pedidos", () => {
    renderizar();
    expect(document.body.textContent).not.toMatch(/nuvemshop/i);
    expect(document.body.textContent).not.toMatch(/pedidos/i);
  });
});
