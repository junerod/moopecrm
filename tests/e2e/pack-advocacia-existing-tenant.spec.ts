/**
 * Pack Advocacia em organização JÁ existente — sem signup novo.
 */
import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "PackAdvExistente!2026#Qa";

type Conta = { email: string; userId: string; orgId: string };

async function criarTenantExistente(): Promise<Conta> {
  const email = `pack-adv-exist-${randomUUID().slice(0, 8)}@qa.local`;
  const { data: criado, error: errUser } = await svc.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (errUser || !criado.user) throw errUser ?? new Error("sem usuário");

  const { data: org, error: errOrg } = await svc
    .from("organizations")
    .insert({
      slug: `pack-adv-exist-${randomUUID().slice(0, 8)}`,
      display_name: "Escritório Já Existente",
      legal_name: "Escritório Já Existente",
      status: "active",
      created_by: criado.user.id,
      onboarded_at: new Date().toISOString(),
      settings: { llm: { provider: "anthropic" }, ai_mode: "copilot" },
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
  await page.waitForURL(/\/app\//, { timeout: 30_000 });
}

let conta: Conta;

test.describe.configure({ mode: "serial", timeout: 180_000 });

test.beforeAll(async () => {
  conta = await criarTenantExistente();
});

test.afterAll(async () => {
  await limpar(conta);
});

test("tenant existente ativa Advocacia pelo Meu Negócio e vê os 6 assistentes", async ({ page }) => {
  await login(page, conta.email);
  await page.goto("/app/settings/business");
  await expect(page.getByTestId("modelo-do-negocio")).toBeVisible();
  await expect(page.getByTestId("ativar-pack-escritorio_advocacia")).toBeVisible();

  await page.getByTestId("ativar-pack-escritorio_advocacia").click();
  await expect(page.getByTestId("usar-modelo-escritorio_advocacia")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("modelo-assistente-recepcao")).toContainText("Atendimento do Escritório");
  await expect(page.getByTestId("modelo-assistente-comercial")).toContainText("Novos Clientes");
  await expect(page.getByTestId("modelo-assistente-documentos")).toContainText("Documentos e Pendências");
  await expect(page.getByTestId("aviso-automacoes-desligadas")).toBeVisible();
  await page.getByTestId("usar-modelo-escritorio_advocacia").click();
  await expect(page.getByTestId("pack-pronto")).toBeVisible({ timeout: 30_000 });

  await page.goto("/app/settings/business");
  await expect(page.getByTestId("pack-escritorio_advocacia-ativo")).toBeVisible();
  await expect(page.getByText(/Pack ativo: Escritório de advocacia/i)).toBeVisible();

  await page.goto("/app/ai/agents");
  await expect(page.getByTestId("card-assistente-recepcao")).toBeVisible();
  await expect(page.getByTestId("card-assistente-documentos")).toBeVisible();
});
