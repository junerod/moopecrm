/**
 * Pack Locadora v1 — onboarding pela tela, instalação, test-drive e isolamento.
 * Sem WhatsApp real, sem QR, sem reconnect.
 */
import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "PackLocadora!2026#Qa";

test.describe.configure({ mode: "serial", timeout: 180_000 });

type Conta = { email: string; userId: string; orgId: string };

async function criarConta(prefixo: string): Promise<Conta> {
  const email = `${prefixo}-${randomUUID().slice(0, 8)}@qa.local`;
  const { data: criado, error: errUser } = await svc.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (errUser || !criado.user) throw errUser ?? new Error("sem usuário");

  const { data: org, error: errOrg } = await svc
    .from("organizations")
    .insert({
      slug: `${prefixo}-${randomUUID().slice(0, 8)}`,
      display_name: "Minha Empresa",
      legal_name: "Minha Empresa",
      status: "active",
      created_by: criado.user.id,
      settings: { llm: { provider: "anthropic" }, ai_mode: "off" },
    })
    .select("id")
    .single();
  if (errOrg || !org) throw errOrg ?? new Error("sem org");

  await svc.from("user_organizations").insert({
    organization_id: org.id,
    user_id: criado.user.id,
    role: "admin",
    accepted_at: new Date().toISOString(),
  });

  return { email, userId: criado.user.id, orgId: org.id as string };
}

async function limpar(conta: Conta | null) {
  if (!conta) return;
  await svc.from("ai_agents").delete().eq("organization_id", conta.orgId);
  await svc.from("automation_rules").delete().eq("organization_id", conta.orgId);
  await svc.from("message_templates").delete().eq("organization_id", conta.orgId);
  await svc.from("crm_stages").delete().eq("organization_id", conta.orgId);
  await svc.from("crm_pipelines").delete().eq("organization_id", conta.orgId);
  await svc.from("user_organizations").delete().eq("organization_id", conta.orgId);
  await svc.from("organizations").delete().eq("id", conta.orgId);
  await svc.auth.admin.deleteUser(conta.userId);
}

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/(app|onboarding)\//, { timeout: 30_000 });
}

let orgA: Conta;
let orgB: Conta;

test.beforeAll(async () => {
  orgA = await criarConta("pack-a");
  orgB = await criarConta("pack-b");
});

test.afterAll(async () => {
  await limpar(orgA);
  await limpar(orgB);
});

test("escolhe Locadora, instala o Pack e termina o wizard", async ({ page }) => {
  await login(page, orgA.email);
  await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });

  await page.locator("#display_name").fill("Locadora ABC");
  await page.getByTestId("pack-locadora-card").click();
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /usar modelo para locadora/i }).click();

  await page.waitForURL(/\/onboarding\/pack/, { timeout: 30_000 });
  await expect(page.getByText(/vamos preparar sua operação/i)).toBeVisible();
  await page.getByTestId("preparar-locadora").click();

  await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 45_000 });
  await page.getByRole("button", { name: /pular por enquanto/i }).click();
  await page.waitForURL(/\/onboarding\/quem-atende/, { timeout: 30_000 });
  await page.getByRole("button", { name: /^continuar$/i }).click();

  await page.waitForURL(/\/onboarding\/funil/, { timeout: 30_000 });
  await expect(page.locator("body")).toContainText("Novo lead");
  await expect(page.locator("body")).toContainText("Fechado — Locação");
  await page.getByRole("button", { name: /usar esta organização/i }).click();

  await page.waitForURL(/\/onboarding\/follow-up/, { timeout: 30_000 });
  await page.getByRole("button", { name: /^continuar$/i }).click();

  await page.waitForURL(/\/onboarding\/setup-ai/, { timeout: 30_000 });
  await page.getByText("Assistente IA").click();
  await page.getByRole("button", { name: /^continuar$/i }).click();

  await page.waitForURL(/\/onboarding\/invite-team/, { timeout: 30_000 });
  await page.getByRole("button", { name: /pular por enquanto/i }).click();
  await page.waitForURL(/\/onboarding\/done/, { timeout: 30_000 });
  await page.getByRole("button", { name: /começar a usar/i }).click();
  await page.waitForURL(/\/app\//, { timeout: 30_000 });

  await page.goto("/app/modelos-prontos");
  await expect(page.getByTestId("pack-pronto")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("modelos-prontos-cards")).toBeVisible();
  await expect(page.getByTestId("testar-assistentes")).toBeVisible();

  await page.getByRole("button", { name: /^Boleto$/ }).click();
  await page.getByTestId("test-drive-enviar").click();
  await expect(page.getByTestId("test-drive-resultado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("test-drive-resposta")).toContainText(/não consegui consultar/i);
  await expect(page.getByTestId("test-drive-resultado")).toContainText("financeiro");

  await page.getByRole("button", { name: /^Disponibilidade$/ }).click();
  await page.getByTestId("test-drive-enviar").click();
  await expect(page.getByTestId("test-drive-resposta")).toContainText(/não posso afirmar disponibilidade/i);

  await page.getByRole("button", { name: /Quero alugar/i }).click();
  await page.getByTestId("test-drive-enviar").click();
  await expect(page.getByTestId("test-drive-resultado")).toContainText(/Consultor Comercial|comercial/i);

  const { count: agentesAntes } = await svc
    .from("ai_agents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgA.orgId)
    .is("archived_at", null);
  await svc
    .from("ai_agents")
    .update({ name: "Consultor da casa" })
    .eq("organization_id", orgA.orgId)
    .eq("name", "Consultor Comercial");
  await page.getByRole("button", { name: /reaplicar sem duplicar/i }).click();
  await expect(page.getByText(/operação preparada/i)).toBeVisible({ timeout: 20_000 });
  const { count: agentesDepois } = await svc
    .from("ai_agents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgA.orgId)
    .is("archived_at", null);
  expect(agentesDepois).toBe(agentesAntes);
  const { data: custom } = await svc
    .from("ai_agents")
    .select("id")
    .eq("organization_id", orgA.orgId)
    .eq("name", "Consultor da casa")
    .maybeSingle();
  expect(custom?.id).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("pack-pronto")).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByTestId("modelos-prontos-cards")).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByTestId("dados-assistentes")).toBeVisible();
});

test("funil, inbound, agentes, coleções, automações e respostas rápidas", async () => {
  const { data: org } = await svc
    .from("organizations")
    .select("settings")
    .eq("id", orgA.orgId)
    .maybeSingle();
  const settings = (org?.settings ?? {}) as {
    business_pack?: { id?: string; version?: string };
    crm?: { inbound_pipeline_id?: string };
    knowledge_collections?: Array<{ slug: string; name: string }>;
    ai_mode?: string;
  };
  expect(settings.business_pack?.id).toBe("locadora_veiculos");
  expect(settings.business_pack?.version).toBe("1.0");
  expect(settings.ai_mode).not.toBe("autonomous");
  expect(settings.crm?.inbound_pipeline_id).toBeTruthy();

  const slugs = (settings.knowledge_collections ?? []).map((c) => c.slug);
  expect(slugs).toEqual(
    expect.arrayContaining([
      "suporte-da-locadora",
      "comercial-da-locadora",
      "politicas-e-contratos",
      "conhecimento-geral",
    ]),
  );

  const { data: funil } = await svc
    .from("crm_pipelines")
    .select("id, name")
    .eq("id", settings.crm!.inbound_pipeline_id!)
    .maybeSingle();
  expect(funil?.name).toBe("COMERCIAL — LOCADORA");

  const { data: etapas } = await svc
    .from("crm_stages")
    .select("name")
    .eq("pipeline_id", funil!.id)
    .eq("is_archived", false);
  expect((etapas ?? []).map((e) => e.name)).toEqual(
    expect.arrayContaining(["Novo lead", "Cotação / Proposta", "Fechado — Locação", "Perdido"]),
  );

  const { data: agentes } = await svc
    .from("ai_agents")
    .select("name, is_default, config")
    .eq("organization_id", orgA.orgId)
    .is("archived_at", null);
  const nomes = (agentes ?? []).map((a) => a.name);
  expect(nomes).toEqual(
    expect.arrayContaining([
      "Atendimento da Locadora",
      "Assistente Financeiro",
      "Assistente de Disponibilidade",
      "Atendimento ao Cliente",
      "Relacionamento",
    ]),
  );
  expect(nomes.some((n) => n === "Consultor Comercial" || n === "Consultor da casa")).toBe(true);

  const { data: regras } = await svc
    .from("automation_rules")
    .select("name, is_active")
    .eq("organization_id", orgA.orgId);
  expect((regras ?? []).some((r) => /2 horas/i.test(r.name) && r.is_active === false)).toBe(true);

  const { data: tpls } = await svc
    .from("message_templates")
    .select("title")
    .eq("organization_id", orgA.orgId);
  const titulos = (tpls ?? []).map((t) => t.title);
  expect(titulos).toEqual(expect.arrayContaining(["Saudação", "Solicitar período", "Volte a alugar com a gente"]));
});

test("tenant B não vê o pack da A", async ({ page }) => {
  const { data: org } = await svc
    .from("organizations")
    .select("settings")
    .eq("id", orgB.orgId)
    .maybeSingle();
  const pack = (org?.settings as { business_pack?: unknown } | null)?.business_pack;
  expect(pack ?? null).toBeFalsy();

  await login(page, orgB.email);
  await page.goto("/onboarding/welcome");
  await expect(page.getByTestId("pack-locadora-card")).toBeVisible({ timeout: 20_000 });
  await page.goto("/app/modelos-prontos");
  await expect(page.getByTestId("pack-pronto")).toHaveCount(0);
});
