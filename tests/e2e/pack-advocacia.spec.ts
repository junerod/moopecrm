/**
 * Pack Advocacia v1 — instalação, test-drive jurídico e isolamento.
 * Sem WhatsApp real.
 */
import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "PackAdvocacia!2026#Qa";

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
  orgA = await criarConta("pack-adv-a");
  orgB = await criarConta("pack-adv-b");
});

test.afterAll(async () => {
  await limpar(orgA);
  await limpar(orgB);
});

test("escolhe Advocacia, instala o Pack e testa sem inventar andamento", async ({ page }) => {
  await login(page, orgA.email);
  await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });
  await page.locator("#display_name").fill("Silva Advogados");
  await page.getByTestId("pack-advocacia-card").click();
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /usar modelo para escritório/i }).click();

  await page.waitForURL(/\/onboarding\/pack/, { timeout: 30_000 });
  await page.getByTestId("preparar-pack").click();
  await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 45_000 });
  await page.getByRole("button", { name: /pular por enquanto/i }).click();
  await page.waitForURL(/\/onboarding\/quem-atende/, { timeout: 30_000 });
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.waitForURL(/\/onboarding\/funil/, { timeout: 30_000 });
  await expect(page.locator("body")).toContainText("Novo contato");
  await expect(page.locator("body")).toContainText("Contratado");
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
  await page.getByRole("button", { name: /^Andamento$/ }).click();
  await page.getByTestId("test-drive-enviar").click();
  await expect(page.getByTestId("test-drive-resposta")).toContainText(/advogado|não consulto andamento/i);
  await expect(page.getByTestId("test-drive-resultado")).toContainText(/precisa de uma pessoa:\s*sim/i);

  await page.getByRole("button", { name: /^Honorários$/ }).click();
  await page.getByTestId("test-drive-enviar").click();
  await expect(page.getByTestId("test-drive-resposta")).not.toContainText(/R\$\s*\d/);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("pack-pronto")).toBeVisible();
});

test("tenant B não vê o pack da A", async () => {
  const { data: org } = await svc.from("organizations").select("settings").eq("id", orgB.orgId).maybeSingle();
  const pack = (org?.settings as { business_pack?: { id?: string } } | null)?.business_pack;
  expect(pack?.id ?? null).toBeFalsy();

  const { data: orgArow } = await svc.from("organizations").select("settings").eq("id", orgA.orgId).maybeSingle();
  expect((orgArow?.settings as { business_pack?: { id?: string } }).business_pack?.id).toBe("escritorio_advocacia");
  expect((orgArow?.settings as { ai_mode?: string }).ai_mode).not.toBe("autonomous");
});
