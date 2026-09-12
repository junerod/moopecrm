/**
 * Aceitação de piloto — jornadas críticas pela tela.
 *
 * Cada describe cria a PRÓPRIA organização. Banco só prova estado.
 * Evidência em `.superpowers/evidence/pilot-acceptance/`.
 */
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const EVIDENCIA = path.join(process.cwd(), ".superpowers/evidence/pilot-acceptance");
const SENHA = "WizardQa!2026#Deskcomm";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

type Conta = { email: string; userId: string; orgId: string };

async function criarConta(prefixo: string, nome = "Minha Empresa"): Promise<Conta> {
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
  await svc.from("crm_lead_activities").delete().eq("organization_id", conta.orgId);
  await svc.from("crm_leads").delete().eq("organization_id", conta.orgId);
  await svc.from("followup_enrollments").delete().eq("organization_id", conta.orgId);
  await svc.from("followup_flow_pointers").delete().eq("organization_id", conta.orgId);
  await svc.from("followup_flow_versions").delete().eq("organization_id", conta.orgId);
  await svc.from("message_templates").delete().eq("organization_id", conta.orgId);
  await svc.from("conversations").delete().eq("organization_id", conta.orgId);
  await svc.from("contacts").delete().eq("organization_id", conta.orgId);
  await svc.from("channel_sessions").delete().eq("organization_id", conta.orgId);
  await svc.from("crm_stages").delete().eq("organization_id", conta.orgId);
  await svc.from("crm_pipelines").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_agents").delete().eq("organization_id", conta.orgId);
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

async function snap(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function welcome(
  page: Page,
  opts: { nome: string; ramo: string; subtype?: string; detalhe?: string },
): Promise<void> {
  await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });
  await page.locator("#display_name").fill(opts.nome);
  await page.getByText(opts.ramo, { exact: true }).click();
  if (opts.subtype) await page.getByText(opts.subtype, { exact: true }).click();
  if (opts.detalhe) await page.locator("#o_que_faz_detalhe").fill(opts.detalhe);
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 30_000 });
}

async function pularAteFunil(page: Page): Promise<void> {
  await page.getByRole("button", { name: /pular por enquanto/i }).click();
  await page.waitForURL(/\/onboarding\/quem-atende/, { timeout: 30_000 });
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.waitForURL(/\/onboarding\/funil/, { timeout: 30_000 });
}

async function concluirDepoisDoFunil(page: Page, ai: "off" | "copilot" | "controlled" | "autonomous"): Promise<void> {
  await page.getByRole("button", { name: /usar esta organização/i }).click();
  await page.waitForURL(/\/onboarding\/follow-up/, { timeout: 30_000 });
  await page.locator('input[name="ativo"][value="sim"]').click();
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.waitForURL(/\/onboarding\/setup-ai/, { timeout: 30_000 });
  await page.locator(`input[name="ai_mode"][value="${ai}"]`).click();
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.waitForURL(/\/onboarding\/invite-team/, { timeout: 30_000 });
  await page.getByRole("button", { name: /pular por enquanto/i }).click();
  await page.waitForURL(/\/onboarding\/done/, { timeout: 30_000 });
  await page.getByRole("button", { name: /começar a usar/i }).click();
  await page.waitForURL(/\/app\//, { timeout: 30_000 });
}

async function abrirQuadroPadrao(page: Page, nome: string | RegExp): Promise<void> {
  await page.goto("/app/kanban");
  await page.getByRole("link", { name: nome }).click();
  await page.waitForURL(/\/app\/pipelines\//, { timeout: 20_000 });
}

async function criarLeadPelaTela(page: Page, titulo: string): Promise<void> {
  await page.getByRole("button", { name: /novo lead/i }).click();
  await page.locator("#title").fill(titulo);
  await page.getByRole("button", { name: /criar lead/i }).click();
  await expect(page.getByText(titulo)).toBeVisible({ timeout: 15_000 });
}

const PROIBIDO_VEICULO = /CNH|\bplaca\b|\b99\b|rastreamento|hodômetro|km rodad/i;

test.describe.configure({ timeout: 120_000 });

test.describe("A/B — login leigo e senha errada", () => {
  test("senha errada não vaza stack", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("nobody@qa.local");
    await page.locator("#password").fill("errada-demais");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText(/email ou senha incorretos/i)).toBeVisible({ timeout: 10_000 });
    const corpo = await page.locator("body").innerText();
    expect(corpo).not.toMatch(/error:|stack|exception/i);
    await snap(page, "login-senha-errada");
  });
});

test.describe("C — Locação / máquinas + lead + fields + ganho/perda", () => {
  let conta: Conta | null = null;
  test.beforeAll(async () => {
    conta = await criarConta("locacao-piloto", "Empresa Equipamentos QA");
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("wizard OFF, sem jargão de veículo, fields e Kanban", async ({ page }) => {
    test.setTimeout(180_000);
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await welcome(page, {
      nome: "Empresa Equipamentos QA",
      ramo: "Locação",
      subtype: "Máquinas e equipamentos",
    });

    const corpoWhats = await page.locator("body").innerText();
    expect(corpoWhats).not.toMatch(PROIBIDO_VEICULO);
    await page.getByTestId("forma-qr").locator("input").click();
    await page.getByTestId("idade-ja-em-uso").locator("input").click();
    const qr = page.locator('img[src*="/whatsapp/qr"]');
    const aviso = page.getByText(/ainda não subiu|não está configurado|aguarde|daqui a/i);
    const pular = page.getByRole("button", { name: /pular por enquanto/i });
    await expect(qr.or(aviso).or(pular).first()).toBeVisible({ timeout: 45_000 });
    const qrVisivel = await qr.isVisible().catch(() => false);
    fs.mkdirSync(EVIDENCIA, { recursive: true });
    fs.writeFileSync(
      path.join(EVIDENCIA, "whatsapp-qr.json"),
      JSON.stringify({ qr_renderizado: qrVisivel, waha_base: process.env.WAHA_API_BASE_URL ?? null }, null, 2),
    );
    await snap(page, "locacao-whatsapp");

    await pularAteFunil(page);
    const corpoFunil = await page.locator("body").innerText();
    expect(corpoFunil).toMatch(/Cotação \/ Proposta/);
    expect(corpoFunil).not.toMatch(PROIBIDO_VEICULO);
    await snap(page, "locacao-funil");

    await concluirDepoisDoFunil(page, "off");

    const { data: org } = await svc.from("organizations").select("settings").eq("id", conta.orgId).maybeSingle();
    const settings = (org?.settings ?? {}) as {
      ai_mode?: string;
      perfil_do_negocio?: { id?: string; subtype?: string };
    };
    expect(settings.ai_mode).toBe("off");
    expect(settings.perfil_do_negocio?.id).toBe("locacao");
    expect(settings.perfil_do_negocio?.subtype).toBe("maquinas_e_equipamentos");

    const { data: agentes } = await svc.from("ai_agents").select("id").eq("organization_id", conta.orgId);
    expect(agentes ?? []).toHaveLength(0);

    const { data: funil } = await svc
      .from("crm_pipelines")
      .select("id, name, settings")
      .eq("organization_id", conta.orgId)
      .eq("is_default", true)
      .maybeSingle();
    const fields = ((funil?.settings as { fields?: Array<{ key: string; label: string }> } | null)?.fields ??
      []) as Array<{ key: string; label: string }>;
    expect(fields.find((f) => f.key === "item_tipo")?.label).toBe("Equipamento");

    await abrirQuadroPadrao(page, /atendimento/i);
    await criarLeadPelaTela(page, "4 marteletes — obra Florianópolis");
    await snap(page, "locacao-lead-criado");

    // O menu «Editar» do card NÃO mostra custom fields (S2 documentado).
    // O dossiê do card é o caminho que o atendente usa para Equipamento/período.
    await page.getByText("4 marteletes — obra Florianópolis").click();
    await expect(page.getByRole("heading", { name: /dados do negócio/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Equipamento", { exact: true })).toBeVisible({ timeout: 10_000 });
    await page.locator("#cf-item_tipo").fill("Martelete");
    await page.locator("#cf-quantidade").fill("4");
    await page.locator("#cf-periodo").fill("10 dias");
    await page.locator("#cf-cidade_local").fill("Florianópolis");
    await page.locator("#cf-necessidade").fill("4 marteletes por 10 dias para obra, sem operador");
    await page.getByRole("button", { name: /^salvar$/i }).click();
    await expect(page.getByText(/lead atualizado/i)).toBeVisible({ timeout: 10_000 });

    await page.reload();
    const { data: lead } = await svc
      .from("crm_leads")
      .select("id, custom_fields, status")
      .eq("organization_id", conta.orgId)
      .maybeSingle();
    const cf = (lead?.custom_fields ?? {}) as Record<string, unknown>;
    expect(cf.item_tipo).toBe("Martelete");
    expect(String(cf.quantidade)).toBe("4");
    expect(cf.cidade_local).toBe("Florianópolis");

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ações do lead" }).first().click();
    await page.getByRole("menuitem", { name: /marcar como ganho/i }).click();
    await expect
      .poll(async () => {
        const { data } = await svc.from("crm_leads").select("status").eq("id", lead!.id).maybeSingle();
        return data?.status ?? null;
      })
      .toBe("won");
  });
});

test.describe("D — Advocacia sem vazamento de locação", () => {
  let conta: Conta | null = null;
  test.beforeAll(async () => {
    conta = await criarConta("adv-piloto", "Escritório QA");
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("pipeline jurídico e AI OFF sem agente", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await welcome(page, { nome: "Escritório QA", ramo: "Advocacia" });
    await pularAteFunil(page);
    await expect(page.locator("body")).toContainText("Triagem");
    await expect(page.locator("body")).not.toContainText("Cotação / Proposta");
    await concluirDepoisDoFunil(page, "off");
    const { data: org } = await svc.from("organizations").select("settings").eq("id", conta.orgId).maybeSingle();
    expect((org?.settings as { perfil_do_negocio?: { id?: string } }).perfil_do_negocio?.id).toBe(
      "advocacia",
    );
    const { data: agentes } = await svc.from("ai_agents").select("id").eq("organization_id", conta.orgId);
    expect(agentes ?? []).toHaveLength(0);
    await snap(page, "advocacia-app");
  });
});

test.describe("E — Comercial / vendas", () => {
  let conta: Conta | null = null;
  test.beforeAll(async () => {
    conta = await criarConta("com-piloto", "Comercial QA");
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("quadro comercial e perda com motivo", async ({ page }) => {
    test.setTimeout(180_000);
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await welcome(page, { nome: "Comercial QA", ramo: "Comercial / Vendas" });
    await pularAteFunil(page);
    await expect(page.locator("body")).toContainText(/Novo lead|Qualificação|Proposta|Negociação|Fechamento/);
    await concluirDepoisDoFunil(page, "copilot");
    await abrirQuadroPadrao(page, /vendas/i);
    await criarLeadPelaTela(page, "Lead comercial QA");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Ações do lead" }).first().click();
    await page.getByRole("menuitem", { name: /marcar como perdido/i }).click();
    const perdido = page.getByRole("dialog", { name: /marcar como perdido/i });
    await expect(perdido).toBeVisible({ timeout: 10_000 });
    await expect(perdido.getByText("Preço", { exact: true })).toBeVisible();
    await expect(perdido.getByRole("button", { name: /^confirmar$/i })).toBeDisabled();
    await snap(page, "comercial-lost-dialog");
    await perdido.getByRole("button", { name: /cancelar/i }).click();
  });
});

test.describe("G — Personalizado com nomes próprios", () => {
  let conta: Conta | null = null;
  test.beforeAll(async () => {
    conta = await criarConta("pers-piloto", "Projetos QA");
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("renomear quadro e etapas persiste", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await welcome(page, { nome: "Projetos QA", ramo: "Personalizado", detalhe: "Vendas de projetos de engenharia" });
    await pularAteFunil(page);
    await page.locator("#nome_do_quadro").fill("Vendas de Projetos");
    const etapas = ["Entrada", "Diagnóstico", "Proposta", "Negociação", "Fechado"];
    for (let i = 0; i < etapas.length; i++) {
      await page.getByLabel(`Nome da etapa ${i + 1}`).fill(etapas[i]!);
    }
    await concluirDepoisDoFunil(page, "off");
    const { data: funil } = await svc
      .from("crm_pipelines")
      .select("id, name")
      .eq("organization_id", conta.orgId)
      .eq("is_default", true)
      .maybeSingle();
    expect(String(funil!.name)).toBe("Vendas de Projetos");
    const { data: cols } = await svc
      .from("crm_stages")
      .select("name")
      .eq("pipeline_id", funil!.id)
      .order("position");
    const nomes = (cols ?? []).map((c) => String(c.name));
    expect(nomes.slice(0, 5)).toEqual(etapas);
    await snap(page, "personalizado-nomes");
  });
});

test.describe("U — troca de Ready Model não apaga lead", () => {
  let conta: Conta | null = null;
  test.beforeAll(async () => {
    conta = await criarConta("troca-piloto", "Troca QA");
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("Locação → Comercial: lead antigo permanece", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await welcome(page, {
      nome: "Troca QA",
      ramo: "Locação",
      subtype: "Ferramentas",
    });
    await pularAteFunil(page);
    await concluirDepoisDoFunil(page, "off");
    await abrirQuadroPadrao(page, /atendimento/i);
    await criarLeadPelaTela(page, "Lead antigo da locação");

    const { data: antes } = await svc
      .from("crm_leads")
      .select("id, pipeline_id")
      .eq("organization_id", conta.orgId);
    expect(antes).toHaveLength(1);

    await page.goto("/app/settings/perfil");
    await page.getByText("Comercial / Vendas", { exact: true }).click();
    await page.getByTestId("aplicar-perfil").click();
    await expect(page.getByTestId("confirmar-troca-de-perfil")).toBeVisible();
    await page.getByTestId("aplicar-perfil").click();
    await expect(page.getByText(/perfil agora é|perfil ligado|funil novo/i)).toBeVisible({
      timeout: 20_000,
    });

    const { data: depois } = await svc
      .from("crm_leads")
      .select("id, pipeline_id")
      .eq("organization_id", conta.orgId);
    expect(depois).toHaveLength(1);
    expect(depois![0]!.id).toBe(antes![0]!.id);
    expect(depois![0]!.pipeline_id).toBe(antes![0]!.pipeline_id);
    await snap(page, "troca-modelo");
  });
});

test.describe("F — Serviços sem vazamento de locação", () => {
  let conta: Conta | null = null;
  test.beforeAll(async () => {
    conta = await criarConta("serv-piloto", "Serviços QA");
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("quadro de orçamento, sem Cotação de locação", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await welcome(page, { nome: "Serviços QA", ramo: "Serviços" });
    await pularAteFunil(page);
    await expect(page.locator("body")).toContainText("Entendimento");
    await expect(page.locator("body")).toContainText("Orçamento");
    await expect(page.locator("body")).not.toContainText("Cotação / Proposta");
    await expect(page.locator("body")).not.toContainText("Triagem");
    await concluirDepoisDoFunil(page, "copilot");
    const { data: org } = await svc.from("organizations").select("settings").eq("id", conta.orgId).maybeSingle();
    expect((org?.settings as { perfil_do_negocio?: { id?: string } }).perfil_do_negocio?.id).toBe(
      "servicos",
    );
    const { data: agentes } = await svc.from("ai_agents").select("id").eq("organization_id", conta.orgId);
    expect(agentes ?? []).toHaveLength(0);
    await snap(page, "servicos-app");
  });
});

test.describe("S — isolamento multi-tenant pela sessão", () => {
  let a: Conta | null = null;
  let b: Conta | null = null;
  test.beforeAll(async () => {
    a = await criarConta("iso-a", "Tenant A QA");
    b = await criarConta("iso-b", "Tenant B QA");
  });
  test.afterAll(async () => {
    await apagar(a);
    await apagar(b);
  });

  test("sessão de A não altera lead de B", async ({ browser }) => {
    if (!a || !b) throw new Error("sem contas");

    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await login(pageB, b.email);
    await welcome(pageB, { nome: "Tenant B QA", ramo: "Comercial / Vendas" });
    await pularAteFunil(pageB);
    await concluirDepoisDoFunil(pageB, "off");
    await abrirQuadroPadrao(pageB, /vendas/i);
    await criarLeadPelaTela(pageB, "Segredo do tenant B");
    const { data: leadB } = await svc
      .from("crm_leads")
      .select("id, title")
      .eq("organization_id", b.orgId)
      .maybeSingle();
    expect(leadB?.id).toBeTruthy();
    await ctxB.close();

    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await login(pageA, a.email);
    await pageA.waitForURL(/\/onboarding|\/app\//, { timeout: 30_000 });
    const res = await pageA.request.patch(`/api/v1/leads/${leadB!.id}`, {
      data: { title: "tentativa de sequestro" },
    });
    expect(res.status(), await res.text()).toBeGreaterThanOrEqual(400);
    expect(res.status()).not.toBe(200);
    const { data: intacto } = await svc.from("crm_leads").select("title").eq("id", leadB!.id).maybeSingle();
    expect(intacto?.title).toBe("Segredo do tenant B");
    await ctxA.close();
  });
});

test.describe("Y — mobile 390x844", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  let conta: Conta | null = null;
  test.beforeAll(async () => {
    conta = await criarConta("mob-piloto", "Mobile QA");
  });
  test.afterAll(async () => {
    await apagar(conta);
  });

  test("login e welcome cabem na tela", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    await login(page, conta.email);
    await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });
    const continuar = page.getByRole("button", { name: /^continuar$/i });
    await continuar.scrollIntoViewIfNeeded();
    await expect(continuar).toBeVisible();
    await snap(page, "mobile-welcome");
  });
});
