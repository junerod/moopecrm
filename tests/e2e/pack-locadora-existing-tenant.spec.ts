/**
 * Pack Locadora em organização JÁ existente — sem signup novo.
 * Prova a porta Meu Negócio → Modelos prontos → Ativar.
 */
import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "PackExistente!2026#Qa";

type Conta = { email: string; userId: string; orgId: string };

async function criarTenantExistente(): Promise<Conta> {
  const email = `pack-exist-${randomUUID().slice(0, 8)}@qa.local`;
  const { data: criado, error: errUser } = await svc.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (errUser || !criado.user) throw errUser ?? new Error("sem usuário");

  const colecoesAntigas = [
    { id: randomUUID(), name: "Suporte", slug: "suporte" },
    { id: randomUUID(), name: "Comercial", slug: "comercial" },
    { id: randomUUID(), name: "Jurídico", slug: "juridico" },
    { id: randomUUID(), name: "Conhecimento geral", slug: "geral" },
  ];

  const { data: org, error: errOrg } = await svc
    .from("organizations")
    .insert({
      slug: `pack-exist-${randomUUID().slice(0, 8)}`,
      display_name: "Locadora Já Existente",
      legal_name: "Locadora Já Existente",
      status: "active",
      created_by: criado.user.id,
      onboarded_at: new Date().toISOString(),
      settings: {
        llm: { provider: "anthropic" },
        ai_mode: "copilot",
        knowledge_collections: colecoesAntigas,
      },
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

  const { error: errAgent } = await svc.from("ai_agents").insert({
    organization_id: org.id,
    name: "Assistente da empresa",
    description: "Guarda o conhecimento da empresa. Nasce inativo.",
    model: "anthropic/claude-sonnet-4-6",
    system_prompt: "Você ajuda o atendente com o que a empresa cadastrou.",
    is_active: false,
    is_default: true,
    kind: "rag_bot",
    created_by: criado.user.id,
  });
  if (errAgent) throw errAgent;

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

test("tenant existente ativa Locadora pelo Meu Negócio e vê os 6 assistentes", async ({ page }) => {
  const { data: antes } = await svc
    .from("organizations")
    .select("settings")
    .eq("id", conta.orgId)
    .maybeSingle();
  expect((antes?.settings as { business_pack?: unknown } | null)?.business_pack ?? null).toBeFalsy();

  await login(page, conta.email);

  await page.goto("/app/settings/business");
  await expect(page.getByTestId("modelo-do-negocio")).toBeVisible();
  await expect(page.getByTestId("ativar-pack-locadora")).toBeVisible();
  await expect(page.getByTestId("pack-locadora-ativo")).toHaveCount(0);

  await page.getByTestId("ativar-pack-locadora").click();
  await expect(page.getByTestId("usar-modelo-locadora")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("usar-modelo-locadora").click();
  await expect(page.getByTestId("pack-pronto")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pack-loja-ativo")).toBeVisible();

  await page.goto("/app/settings/business");
  await expect(page.getByTestId("pack-locadora-ativo")).toBeVisible();

  await page.goto("/app/ai/agents");
  await expect(page.getByTestId("landing-assistentes")).toBeVisible();
  await expect(page.getByTestId("criar-assistente")).toBeVisible();
  await expect(page.getByTestId("ir-modelos-prontos")).toBeVisible();
  await expect(page.getByTestId("card-assistente-recepcao")).toBeVisible();
  await expect(page.getByTestId("card-assistente-comercial")).toBeVisible();
  await expect(page.getByTestId("card-assistente-financeiro")).toBeVisible();
  await expect(page.getByTestId("card-assistente-disponibilidade")).toBeVisible();
  await expect(page.getByTestId("card-assistente-atendimento")).toBeVisible();
  await expect(page.getByTestId("card-assistente-relacionamento")).toBeVisible();
  await expect(page.getByTestId("meus-assistentes").getByText("Assistente da empresa")).toBeVisible();
  await expect(page.getByText("Já existia na empresa")).toBeVisible();
  await expect(page.getByTestId("assistente-principal")).toBeVisible();

  const { count: agentesAntes } = await svc
    .from("ai_agents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", conta.orgId)
    .is("archived_at", null);

  await page.getByTestId("card-assistente-financeiro").getByRole("link", { name: "Configurar" }).click();
  await expect(page.getByTestId("tab-visao-geral")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Guardrails" })).toHaveCount(0);
  await expect(page.getByText("Regex output block")).toHaveCount(0);
  await page.getByTestId("tab-avancado").click();
  await expect(page.getByTestId("regras-tecnicas")).toBeVisible();
  await page.getByTestId("tab-dados").click();
  await expect(page.getByTestId("dados-e-ferramentas")).toBeVisible();
  await expect(page.getByTestId("dados-e-ferramentas").getByText("Financeiro", { exact: true })).toBeVisible();
  await expect(page.getByTestId("dados-e-ferramentas")).not.toContainText(/mcp_/i);

  const { data: financeiro } = await svc
    .from("ai_agents")
    .select("id")
    .eq("organization_id", conta.orgId)
    .eq("name", "Assistente Financeiro")
    .maybeSingle();
  expect(financeiro?.id).toBeTruthy();

  await page.goto(`/app/ai/knowledge/sources?agent=${financeiro!.id}`);
  await expect(page.getByTestId("conhecimento-do-assistente")).toBeVisible();
  await expect(page.getByTestId("conhecimento-do-assistente")).toContainText("Assistente Financeiro");
  await page.getByTestId("aba-conhecimento-colecoes").click();
  await expect(page.getByTestId("colecao-suporte")).toBeVisible();
  await expect(page.getByTestId("colecao-juridico")).toBeVisible();
  await expect(page.getByTestId("colecao-suporte-da-locadora")).toBeVisible();
  await expect(page.getByTestId("colecao-comercial-da-locadora")).toBeVisible();

  await page.goto("/app/ai/knowledge/sources");
  await expect(page.getByTestId("conhecimento-da-empresa")).toBeVisible();

  await page.goto("/app/modelos-prontos");
  await page.getByRole("button", { name: /reaplicar sem duplicar/i }).click();
  await expect(page.getByText(/operação preparada/i)).toBeVisible({ timeout: 20_000 });
  const { count: agentesDepois } = await svc
    .from("ai_agents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", conta.orgId)
    .is("archived_at", null);
  expect(agentesDepois).toBe(agentesAntes);
  const { data: antigo } = await svc
    .from("ai_agents")
    .select("id")
    .eq("organization_id", conta.orgId)
    .eq("name", "Assistente da empresa")
    .maybeSingle();
  expect(antigo?.id).toBeTruthy();

  await page.goto("/app/ai/agents");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("landing-assistentes")).toBeVisible();
  await expect(page.getByTestId("criar-assistente")).toBeVisible();
  const overflow = await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(8);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByTestId("card-assistente-financeiro")).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.getByTestId("pack-locadora-banner")).toBeVisible();
});
