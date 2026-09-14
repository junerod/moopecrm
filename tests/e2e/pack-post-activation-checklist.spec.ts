/**
 * Checklist pós-ativação — tenant existente, sem WhatsApp real.
 * Progresso muda só com estado real (fixtures isoladas).
 */
import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "PackChecklist!2026#Qa";

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
      display_name: "Empresa Checklist",
      legal_name: "Empresa Checklist",
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
  await svc.from("channel_sessions").delete().eq("organization_id", conta.orgId);
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

async function ativarPack(page: Page, testidAtivar: string, testidUsar: string) {
  await page.goto("/app/settings/business");
  await expect(page.getByTestId("checklist-pos-ativacao")).toHaveCount(0);
  await page.getByTestId(testidAtivar).click();
  await expect(page.getByTestId(testidUsar)).toBeVisible({ timeout: 20_000 });
  await page.getByTestId(testidUsar).click();
  await expect(page.getByTestId("pack-pronto")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("checklist-pos-ativacao")).toBeVisible();
  await expect(page.getByTestId("checklist-progresso")).toHaveText(/0 de 4/);
}

async function lerPack(orgId: string) {
  const { data } = await svc.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  return (data?.settings as { business_pack?: {
    artifacts: {
      agent_keys: Record<string, string>;
      collection_slugs: Record<string, string>;
      automation_keys: Record<string, string>;
    };
  } } | null)?.business_pack ?? null;
}

test.describe.configure({ mode: "serial", timeout: 180_000 });

let locadora: Conta;
let advocacia: Conta;

test.beforeAll(async () => {
  locadora = await criarTenant("chk-loc");
  advocacia = await criarTenant("chk-adv");
});

test.afterAll(async () => {
  await limpar(locadora);
  await limpar(advocacia);
});

test("Locadora: 0/4 → fixtures → 4/4 Pronto para trabalhar", async ({ page }) => {
  await login(page, locadora.email);
  await ativarPack(page, "ativar-pack-locadora", "usar-modelo-locadora");

  await page.goto("/app/settings/business");
  await expect(page.getByTestId("checklist-pos-ativacao")).toBeVisible();
  await expect(page.getByTestId("checklist-progresso")).toHaveText(/0 de 4/);
  await expect(page.getByTestId("checklist-pronto")).toHaveCount(0);

  const { data: sessao, error: errSessao } = await svc
    .from("channel_sessions")
    .insert({
      organization_id: locadora.orgId,
      webhook_secret_encrypted: "e2e",
      provider: "waha",
      waha_session_name: `chk-loc-${randomUUID().slice(0, 8)}`,
      status: "WORKING",
      phone_number: "+5531999000111",
    })
    .select("id")
    .single();
  if (errSessao || !sessao) throw errSessao ?? new Error("sem sessão");

  await page.reload();
  await expect(page.getByTestId("checklist-progresso")).toHaveText(/1 de 4/);
  await expect(page.getByTestId("checklist-status-whatsapp")).toHaveText(/Conectado/);

  const pack = await lerPack(locadora.orgId);
  expect(pack).toBeTruthy();
  const colecao = Object.values(pack!.artifacts.collection_slugs)[0];
  const agenteId = Object.values(pack!.artifacts.agent_keys)[0];
  expect(colecao && agenteId).toBeTruthy();

  const { error: errFonte } = await svc.from("ai_knowledge_sources").insert({
    organization_id: locadora.orgId,
    agent_id: agenteId,
    source_type: "faq",
    name: "Regras da locadora",
    status: "ready",
    is_active: true,
    source_metadata: { collection_ids: [colecao] },
  });
  if (errFonte) throw errFonte;

  await page.reload();
  await expect(page.getByTestId("checklist-progresso")).toHaveText(/2 de 4/);

  for (const id of Object.values(pack!.artifacts.agent_keys)) {
    const { data: versao, error: errV } = await svc
      .from("ai_agent_versions")
      .insert({
        organization_id: locadora.orgId,
        agent_id: id,
        version_number: 1,
        system_prompt: "Fixture de publicação do checklist.",
        provider: "anthropic",
        model: "anthropic/claude-sonnet-4-6",
        channel_session_id: sessao.id,
        status: "published",
        published_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (errV || !versao) throw errV ?? new Error(`versão ${id}`);
    const { error: errPub } = await svc
      .from("ai_agents")
      .update({ published_version_id: versao.id })
      .eq("id", id)
      .eq("organization_id", locadora.orgId);
    if (errPub) throw errPub;
  }

  await page.reload();
  await expect(page.getByTestId("checklist-progresso")).toHaveText(/3 de 4/);
  await expect(page.getByTestId("checklist-status-assistentes")).toContainText(/de 6 publicados/);

  const autoId = Object.values(pack!.artifacts.automation_keys)[0];
  expect(autoId).toBeTruthy();
  const { error: errAuto } = await svc
    .from("automation_rules")
    .update({ is_active: true })
    .eq("id", autoId)
    .eq("organization_id", locadora.orgId);
  if (errAuto) throw errAuto;

  await page.reload();
  await expect(page.getByTestId("checklist-progresso")).toHaveText(/4 de 4/);
  await expect(page.getByTestId("checklist-pronto")).toHaveText(/Pronto para trabalhar/);

  await page.goto("/app/modelos-prontos");
  await expect(page.getByTestId("checklist-pronto")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("checklist-pos-ativacao")).toBeVisible();
});

test("Advocacia: tenant existente vê o mesmo checklist 0/4", async ({ page }) => {
  await login(page, advocacia.email);
  await page.goto("/app/settings/business");
  await expect(page.getByTestId("checklist-pos-ativacao")).toHaveCount(0);
  await page.getByTestId("ativar-pack-escritorio_advocacia").click();
  await expect(page.getByTestId("usar-modelo-escritorio_advocacia")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("usar-modelo-escritorio_advocacia").click();
  await expect(page.getByTestId("pack-pronto")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("checklist-pos-ativacao")).toBeVisible();
  await expect(page.getByTestId("checklist-progresso")).toHaveText(/0 de 4/);
  await expect(page.getByTestId("checklist-pos-ativacao")).toContainText(/Escritório de advocacia/i);
});
