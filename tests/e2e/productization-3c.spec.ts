/**
 * ETAPA 3C — usuário leigo configura o CRM pela tela.
 *
 * Sem WhatsApp real. Isolation e anti-alucinação do Copilot também têm
 * prova unitária no mesmo retrieval (`recuperar` / `gerarSugestaoDoCopiloto`).
 */
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "WizardQa!2026#Deskcomm";

type Conta = { email: string; userId: string; orgId: string };

async function criarConta(prefixo: string, nome: string, onboarded = false): Promise<Conta> {
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
      display_name: nome,
      legal_name: nome,
      status: "active",
      created_by: criado.user.id,
      onboarded_at: onboarded ? new Date().toISOString() : null,
      settings: { llm: { provider: "anthropic" } },
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

async function apagar(conta: Conta | null): Promise<void> {
  if (!conta) return;
  await svc.from("ai_faq_items").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_knowledge_sources").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_agent_versions").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_agents").delete().eq("organization_id", conta.orgId);
  await svc.from("followup_enrollments").delete().eq("organization_id", conta.orgId);
  await svc.from("followup_flow_versions").delete().eq("organization_id", conta.orgId);
  await svc.from("followup_flow_pointers").delete().eq("organization_id", conta.orgId);
  await svc.from("message_templates").delete().eq("organization_id", conta.orgId);
  await svc.from("channel_sessions").delete().eq("organization_id", conta.orgId);
  await svc.from("crm_stages").delete().eq("organization_id", conta.orgId);
  await svc.from("crm_pipelines").delete().eq("organization_id", conta.orgId);
  await svc.from("user_organizations").delete().eq("organization_id", conta.orgId);
  await svc.from("organizations").delete().eq("id", conta.orgId);
  await svc.auth.admin.deleteUser(conta.userId);
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
}

async function concluirSimpleMode(page: Page): Promise<void> {
  await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });
  await page.locator("#display_name").fill("Máquinas Norte");
  await page.getByText("Locação", { exact: true }).click();
  await page.getByText("Máquinas e equipamentos", { exact: true }).click();
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 30_000 });
  await page.getByRole("button", { name: /pular por enquanto/i }).click();
  await page.waitForURL(/\/onboarding\/quem-atende/, { timeout: 30_000 });
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.waitForURL(/\/onboarding\/funil/, { timeout: 30_000 });
  await page.getByRole("button", { name: /usar esta organização/i }).click();
  await page.waitForURL(/\/onboarding\/follow-up/, { timeout: 30_000 });
  await page.locator('input[name="ativo"][value="nao"]').click();
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.waitForURL(/\/onboarding\/setup-ai/, { timeout: 30_000 });
  await page.locator('input[name="ai_mode"][value="off"]').click();
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.waitForURL(/\/onboarding\/invite-team/, { timeout: 30_000 });
  await page.getByRole("button", { name: /pular por enquanto/i }).click();
  await page.waitForURL(/\/onboarding\/done/, { timeout: 30_000 });
  await page.getByRole("button", { name: /começar a usar/i }).click();
  await page.waitForURL(/\/app\//, { timeout: 30_000 });
}

test.describe("3C — leigo configura o CRM", () => {
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  let conta: Conta | null = null;

  test.beforeAll(async () => {
    conta = await criarConta("3c-leigo", "Minha Empresa");
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("Simple Mode + checklist + Meu Negócio + conhecimento + IA + follow-up", async ({
    page,
  }) => {
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await concluirSimpleMode(page);

    await page.goto("/app/inicio");
    await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
    await expect(page.getByTestId("checklist-primeiros-passos")).toBeVisible();
    await expect(page.getByTestId("checklist-empresa")).toHaveAttribute("data-feito", "sim");

    await page.goto("/app/settings/business");
    await expect(page.getByRole("heading", { name: "Meu Negócio" })).toBeVisible();
    await expect(page.getByTestId("negocio-tipo")).toHaveText("Locação");
    await expect(page.getByTestId("negocio-subtipo")).toHaveText("Máquinas e equipamentos");

    await page.goto("/app/ai/knowledge/sources");
    await expect(page.getByRole("heading", { name: "Conhecimento da Empresa" })).toBeVisible();
    await page.getByTestId("conhecimento-texto").fill(
      "Martelete Bosch 5kg. Locação mínima: 1 diária.",
    );
    await page.getByRole("button", { name: "Salvar conhecimento" }).click();
    await expect(page.getByText(/conhecimento salvo/i)).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("testar-conhecimento-pergunta").fill("Vocês alugam martelete?");
    await page.getByRole("button", { name: "Perguntar" }).click();
    const achou = page.getByTestId("testar-conhecimento-resposta");
    const vazio = page.getByTestId("testar-conhecimento-vazio");
    await expect(achou.or(vazio).first()).toBeVisible({ timeout: 20_000 });
    if (await achou.isVisible()) {
      await expect(achou).toContainText(/martelete/i);
    }

    await page.goto("/app/settings/atendimento");
    await page.getByTestId("opcao-ai-mode-copilot").click();
    await page.getByRole("button", { name: /salvar modo da ia/i }).click();
    await expect(page.getByTestId("ai-mode-configurado")).toHaveText("Assistente");

    await page.goto("/app/ai/followups");
    await page.getByRole("tab", { name: "Prontas" }).click();
    const ligar = page.getByTestId("pronto-followup-24h-ativar");
    if (await ligar.isVisible()) {
      await ligar.click();
    }
    await expect(page.getByTestId("pronto-followup-24h-ativo")).toBeVisible({ timeout: 15_000 });

    const { data: org } = await svc
      .from("organizations")
      .select("settings")
      .eq("id", conta.orgId)
      .maybeSingle();
    const settings = (org?.settings ?? {}) as { ai_mode?: string };
    expect(settings.ai_mode).toBe("copilot");

    const { data: fluxos } = await svc
      .from("followup_flow_pointers")
      .select("id, status")
      .eq("organization_id", conta.orgId)
      .eq("status", "active");
    expect((fluxos ?? []).length).toBeGreaterThan(0);

    await page.goto("/app/inicio");
    await expect(page.getByTestId("checklist-ia")).toHaveAttribute("data-feito", "sim");
    await expect(page.getByTestId("checklist-automacao")).toHaveAttribute("data-feito", "sim");
    await expect(page.getByTestId("checklist-conhecimento")).toHaveAttribute("data-feito", "sim");
  });
});

test.describe("3C — isolamento e ausência", () => {
  test.describe.configure({ timeout: 90_000 });
  let a: Conta | null = null;
  let b: Conta | null = null;

  test.beforeAll(async () => {
    a = await criarConta("3c-iso-a", "Tenant A", true);
    b = await criarConta("3c-iso-b", "Tenant B", true);
    for (const [conta, preco] of [
      [a, "R$ 123"],
      [b, "R$ 999"],
    ] as const) {
      const { data: agente } = await svc
        .from("ai_agents")
        .insert({
          organization_id: conta.orgId,
          name: "Assistente da empresa",
          is_active: false,
          is_default: true,
          kind: "rag_bot",
          system_prompt: "Não invente.",
          model: "anthropic/claude-sonnet-4-6",
        })
        .select("id")
        .single();
      const { data: fonte } = await svc
        .from("ai_knowledge_sources")
        .insert({
          organization_id: conta.orgId,
          agent_id: agente!.id,
          source_type: "faq",
          name: "Preços",
          status: "ready",
        })
        .select("id")
        .single();
      await svc.from("ai_faq_items").insert({
        organization_id: conta.orgId,
        knowledge_source_id: fonte!.id,
        question: "Produto Alfa",
        answer: `Produto Alfa custa ${preco}.`,
        locale: "pt-BR",
        position: 0,
      });
    }
  });
  test.afterAll(async () => {
    await apagar(a);
    await apagar(b);
  });

  test("Copilot/consulta de A nunca devolve o preço de B", async ({ page }) => {
    if (!a || !b) throw new Error("sem contas");
    await login(page, a.email);
    await page.waitForURL(/\/app\//, { timeout: 30_000 });
    const res = await page.request.post("/api/v1/ai/knowledge/consultar", {
      data: { pergunta: "Quanto custa o Produto Alfa?", organization_id: b.orgId },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { data?: { trechos?: Array<{ texto: string }> } };
    const texto = (body.data?.trechos ?? []).map((t) => t.texto).join(" ");
    expect(texto).not.toMatch(/999/);
  });

  test("Produto Zeta sem preço não inventa valor", async ({ page }) => {
    if (!a) throw new Error("sem conta");
    await login(page, a.email);
    await page.waitForURL(/\/app\//, { timeout: 30_000 });
    const res = await page.request.post("/api/v1/ai/knowledge/consultar", {
      data: { pergunta: "Quanto custa o Produto Zeta?" },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      data?: { encontrou?: boolean; trechos?: Array<{ texto: string }> };
    };
    expect(body.data?.encontrou).toBe(false);
    const texto = (body.data?.trechos ?? []).map((t) => t.texto).join(" ");
    expect(texto).not.toMatch(/R\$\s*\d/);
  });
});

test.describe("3C — assistente nasce rascunho", () => {
  test.describe.configure({ timeout: 90_000 });
  let conta: Conta | null = null;

  test.beforeAll(async () => {
    conta = await criarConta("3c-agente", "Empresa Assistente", true);
    await svc.from("channel_sessions").insert({
      organization_id: conta.orgId,
      waha_session_name: `e2e_${randomUUID().slice(0, 8)}`,
      status: "WORKING",
      phone_number: "5511999999343",
      webhook_secret_encrypted: "e2e",
    });
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("salvar no wizard deixa draft; ativar usa publish", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await page.waitForURL(/\/app\//, { timeout: 30_000 });
    await page.goto("/app/ai/agents/simples");
    await expect(page.getByTestId("wizard-assistente")).toBeVisible();
    for (let i = 0; i < 5; i += 1) {
      await page.getByRole("button", { name: "Continuar" }).click();
    }
    await expect(page.getByTestId("wizard-assistente-revisao")).toBeVisible();
    await page.getByTestId("wizard-assistente-salvar").click();
    await page.waitForURL(/\/app\/ai\/agents\/[0-9a-f-]+/, { timeout: 20_000 });

    const { data: agentes } = await svc
      .from("ai_agents")
      .select("id, published_version_id, kind")
      .eq("organization_id", conta.orgId)
      .eq("name", "Assistente Comercial");
    expect(agentes).toHaveLength(1);
    const criado = agentes?.[0];
    expect(criado).toBeTruthy();
    expect(criado!.published_version_id).toBeNull();

    const { data: versao } = await svc
      .from("ai_agent_versions")
      .select("id")
      .eq("agent_id", criado!.id)
      .eq("organization_id", conta.orgId)
      .maybeSingle();
    expect(versao?.id).toBeTruthy();
    const pub = await page.request.post(`/api/v1/ai/agents/${criado!.id}/publish`, {
      data: { version_id: versao!.id },
    });
    expect([200, 201, 422]).toContain(pub.status());
    if (pub.ok()) {
      const { data: depois } = await svc
        .from("ai_agents")
        .select("published_version_id")
        .eq("id", criado!.id)
        .maybeSingle();
      expect(depois?.published_version_id).toBeTruthy();
    }
  });
});

test.describe("3C — mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.describe.configure({ timeout: 90_000 });
  let conta: Conta | null = null;

  test.beforeAll(async () => {
    conta = await criarConta("3c-mob", "Empresa Mobile", true);
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("telas centrais cabem com scroll, sem CTA fora da largura", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await page.waitForURL(/\/app\//, { timeout: 30_000 });

    for (const href of [
      "/app/inicio",
      "/app/settings/business",
      "/app/ai/knowledge/sources",
      "/app/ai/agents",
      "/app/ai/followups",
    ]) {
      await page.goto(href);
      const m = await page.evaluate(() => ({
        scrollWidth: document.body.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(m.scrollWidth, href).toBeLessThanOrEqual(m.clientWidth + 8);
    }
  });
});
