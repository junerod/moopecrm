/**
 * Loja ≠ configuração ≠ operação — Modelos prontos não mistura as três.
 */
import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "PackUx!2026#Qa";

type Conta = { email: string; userId: string; orgId: string };

async function criarTenant(prefixo: string): Promise<Conta> {
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
      display_name: "Empresa UX Pack",
      legal_name: "Empresa UX Pack",
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
  await svc.from("ai_agent_versions").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_knowledge_sources").delete().eq("organization_id", conta.orgId);
  await svc.from("automation_rules").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_agents").delete().eq("organization_id", conta.orgId);
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

test.describe.configure({ mode: "serial", timeout: 180_000 });

let conta: Conta;

test.beforeAll(async () => {
  conta = await criarTenant("ux-pack");
});

test.afterAll(async () => {
  await limpar(conta);
});

test("sem pack: loja mostra só o catálogo e o detalhe resume", async ({ page }) => {
  await login(page, conta.email);
  await page.goto("/app/modelos-prontos");
  await expect(page.getByRole("heading", { name: "Modelos prontos" })).toBeVisible();
  await expect(page.getByTestId("catalogo-de-modelos")).toBeVisible();
  await expect(page.getByTestId("catalogo-pack-locadora_veiculos")).toBeVisible();
  await expect(page.getByTestId("catalogo-pack-escritorio_advocacia")).toBeVisible();
  await expect(page.getByTestId("catalogo-pack-vendas_saas")).toBeVisible();
  await expect(page.getByTestId("catalogo-pack-comercial_geral")).toBeVisible();
  await expect(page.getByTestId("catalogo-pack-clinica_medica")).toBeVisible();
  await expect(page.getByTestId("catalogo-pack-clinica_odontologica")).toBeVisible();
  await expect(page.getByTestId("lista-assistentes-do-modelo")).toHaveCount(0);
  await expect(page.getByTestId("quadro-do-modelo")).toHaveCount(0);
  await expect(page.getByTestId("testar-assistentes")).toHaveCount(0);
  await expect(page.getByTestId("dados-assistentes")).toHaveCount(0);

  await page.goto("/app/modelos-prontos/vendas_saas");
  await expect(page.getByText(/o que este modelo prepara/i)).toBeVisible();
  await page.getByTestId("usar-modelo-vendas_saas").click();
  await expect(page.getByTestId("pack-pronto")).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/app\/meu-modelo/);
});

test("pack ativo: loja é banner + catálogo; hub tem checklist e cards", async ({ page }) => {
  await login(page, conta.email);
  await page.goto("/app/modelos-prontos");
  await expect(page.getByTestId("pack-pronto")).toBeVisible();
  await expect(page.getByTestId("loja-continuar-configuracao")).toBeVisible();
  await expect(page.getByTestId("lista-assistentes-do-modelo")).toHaveCount(0);
  await expect(page.getByTestId("quadro-do-modelo")).toHaveCount(0);
  await expect(page.getByTestId("aviso-automacoes-desligadas")).toHaveCount(0);
  await expect(page.getByTestId("testar-assistentes")).toHaveCount(0);

  await page.getByTestId("loja-continuar-configuracao").click();
  await expect(page).toHaveURL(/\/app\/meu-modelo/);
  await expect(page.getByTestId("checklist-pos-ativacao")).toBeVisible();
  await expect(page.getByTestId("hub-card-assistentes")).toBeVisible();
  await expect(page.getByTestId("hub-card-funil")).toBeVisible();
  await expect(page.getByTestId("hub-card-conhecimento")).toBeVisible();
  await expect(page.getByTestId("hub-card-automacoes")).toBeVisible();
  await expect(page.getByTestId("hub-card-campanhas")).toBeVisible();
  await expect(page.getByRole("link", { name: "Configurar" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir quadro" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Adicionar material" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Criar campanha" })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("checklist-pos-ativacao")).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByTestId("hub-card-assistentes")).toBeVisible();
});
