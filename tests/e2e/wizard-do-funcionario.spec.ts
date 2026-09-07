/**
 * O WIZARD, PELA TELA, DENTRO DO CI.
 *
 * A jornada de instalação fresca é a P0 da doutrina de QA deste projeto — é o
 * produto que se vende — e é a ÚNICA spec fora do gate, porque depende de WAHA,
 * Redis, Resend e Nuvemshop. O resultado é que o onboarding pôde apodrecer sem
 * nada ficar vermelho: foi assim que oito premissas mortas chegaram até aqui.
 *
 * Esta spec cobre o que dá para cobrir sem esses serviços — que é quase tudo:
 * o wizard inteiro, do login ao "Começar a usar". Fica de fora só o ensaio com
 * resposta de verdade, que precisa de chave de IA com saldo.
 *
 * ISOLAMENTO: cria a PRÓPRIA organização, com o próprio dono. O seed do CI
 * entrega a organização compartilhada já onboardada, e zerar o estado dela para
 * testar o wizard mandaria todas as specs seguintes para dentro do onboarding.
 */
import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "WizardQa!2026#Deskcomm";
const email = `wizard-${randomUUID().slice(0, 8)}@qa.local`;

let userId = "";
let orgId = "";

/**
 * O estado que o `install.sh` deixa: dono criado, organização com o nome
 * placeholder, provedor de IA escolhido no terminal, e `onboarded_at` nulo.
 */
test.beforeAll(async () => {
  const { data: criado, error: errUser } = await svc.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (errUser || !criado.user) throw errUser ?? new Error("sem usuário");
  userId = criado.user.id;

  const { data: org, error: errOrg } = await svc
    .from("organizations")
    .insert({
      slug: `minha-empresa-${randomUUID().slice(0, 8)}`,
      display_name: "Minha Empresa",
      legal_name: "Minha Empresa",
      status: "active",
      created_by: userId,
      settings: { llm: { provider: "anthropic" } },
    })
    .select("id")
    .single();
  if (errOrg || !org) throw errOrg ?? new Error("sem org");
  orgId = org.id as string;

  await svc.from("user_organizations").insert({
    organization_id: orgId,
    user_id: userId,
    role: "admin",
    accepted_at: new Date().toISOString(),
  });
});

test.afterAll(async () => {
  if (orgId) {
    await svc.from("ai_agent_runs").delete().eq("organization_id", orgId);
    await svc.from("ai_agent_versions").delete().eq("organization_id", orgId);
    await svc.from("ai_agents").delete().eq("organization_id", orgId);
    await svc.from("org_memory_pointers").delete().eq("organization_id", orgId);
    await svc.from("org_memory_versions").delete().eq("organization_id", orgId);
    await svc.from("crm_stages").delete().eq("organization_id", orgId);
    await svc.from("crm_pipelines").delete().eq("organization_id", orgId);
    await svc.from("user_organizations").delete().eq("organization_id", orgId);
  }
  if (userId) await svc.auth.admin.deleteUser(userId);
});

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
}

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.describe("o wizard monta um funcionário", () => {
  test("abre mostrando o que a instalação já trouxe, e não pede o nome de novo", async ({
    page,
  }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });

    // O passo 1 começa pelo que já existe — em vez de um formulário em branco.
    await expect(page.getByText(/já está de pé/i)).toBeVisible();

    // O instalador nunca pergunta o nome do negócio: a organização nasce
    // "Minha Empresa". Mandar isso como valor inicial obrigava a pessoa a
    // apagá-lo, e quem não percebia ficava com o placeholder para sempre.
    await expect(page.locator("#display_name")).toHaveValue("");
  });

  test("o aceite de termos leva a documentos que EXISTEM", async ({ page }) => {
    // O checkbox é obrigatório e linkava duas páginas que respondiam 404.
    for (const href of ["/legal/terms", "/legal/privacy"]) {
      const res = await page.request.get(href);
      expect(res.status(), href).toBe(200);
    }
  });

  test("o nome do negócio chega ao cabeçalho do passo seguinte", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });

    await page.locator("#display_name").fill("Clínica Bem Viver");
    await page.getByText("Serviços", { exact: true }).click();
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 30_000 });

    // O layout do wizard é compartilhado entre os passos e não re-renderizava:
    // o cabeçalho seguia dizendo "Minha Empresa" o onboarding inteiro, mesmo
    // com o banco já gravado.
    // `.first()`: há dois <header> na página — o do wizard (com a marca e o
    // nome do negócio) e o do passo. O do layout é o que congelava.
    const cabecalho = page.locator("header").first();
    await expect(cabecalho).toContainText("Clínica Bem Viver");
    await expect(cabecalho).not.toContainText("Minha Empresa");
  });

  test("o passo do telefone pergunta COMO se conecta antes de assumir o código", async ({
    page,
  }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 30_000 });

    // As três formas que o produto realmente suporta — as mesmas da tela de
    // Conexões. Antes, o wizard oferecia uma e nem perguntava: a sessão do
    // canal por código subia sozinha na montagem da tela.
    await expect(page.getByTestId("forma-qr")).toBeVisible();
    await expect(page.getByTestId("forma-oficial")).toBeVisible();
    await expect(page.getByTestId("forma-parceiro")).toBeVisible();

    // Nenhuma escolha feita: o código não pode estar na tela ainda.
    await expect(page.locator('img[src*="/whatsapp/qr"]')).toHaveCount(0);

    // A cópia visível fala a língua de quem vende, nunca a do transporte.
    const corpo = page.locator("body");
    await expect(corpo).not.toContainText(/provider/i);
    await expect(corpo).not.toContainText(/channel_session/i);

    // Escolher a conta oficial leva ao formulário dela, e dá para voltar —
    // escolher errado não pode ser uma porta que tranca.
    await page.getByTestId("forma-oficial").locator("input").click();
    await expect(page.getByTestId("canal-oficial-root")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("voltar-para-escolha").click();
    await expect(page.getByTestId("forma-qr")).toBeVisible();

    // NÃO avança: a spec é serial e o caso seguinte começa neste mesmo passo.
    // A escolha vive em memória e não é gravada, então voltar aqui não deixa
    // rastro — se deixasse, o passo já contaria como cumprido.
  });

  test("o passo do telefone não expõe identificador interno nem enum", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 30_000 });

    const corpo = page.locator("body");
    // Mostrava "Sessão: org_f3d61bc0" e "Status: INIT".
    await expect(corpo).not.toContainText(/Sessão:/i);
    await expect(corpo).not.toContainText(/Status:\s*(INIT|STARTING|SCAN_QR_CODE|WORKING)/);
    // E nunca mais manda rodar Docker nem aponta para um menu que não existe.
    await expect(corpo).not.toContainText(/docker compose/i);
    await expect(corpo).not.toContainText(/Configurações → Canais/i);

    await page.getByRole("button", { name: /pular por enquanto/i }).click();
    await page.waitForURL(/\/onboarding\/quem-atende/, { timeout: 30_000 });
  });

  test("quem atende pergunta distribuição, sem jargão de routing", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/quem-atende/, { timeout: 30_000 });
    await expect(page.getByText(/como os novos atendimentos devem ser distribuídos/i)).toBeVisible();
    await expect(page.getByText(/^Manual$/)).toBeVisible();
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/funil/, { timeout: 30_000 });
  });

  test("o quadro chega montado, venha da IA ou de um modelo pronto", async ({ page }) => {
    // ⚠️ ESTE CASO VALE NOS DOIS MUNDOS, DE PROPÓSITO. No CI não há chave de
    // provedor nenhum e a sugestão cai no quadro pronto; na máquina de quem
    // desenvolve, `next start` carrega o `.env.local` sozinho e a chave real
    // chega ao servidor sob teste — então a MESMA spec via a IA responder aqui e
    // o pacote no CI. Fixar uma das duas origens faria o gate vermelhar conforme
    // a máquina, que é o pior tipo de teste: o que ensina a ignorá-lo.
    //
    // O que NÃO varia é o que este passo promete: a pessoa nunca fica sem
    // quadro, e a tela diz de onde ele veio.
    await login(page);
    await page.waitForURL(/\/onboarding\/funil/, { timeout: 30_000 });

    const corpo = page.locator("body");
    await expect(corpo).toContainText(/como o atendimento será organizado/i);
    await expect(corpo).toContainText(/Novo contato/);
    await expect(corpo).toContainText(/Orçamento/);
  });

  test("salvar troca o funil de e-commerce pelo do Ready Model", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/funil/, { timeout: 30_000 });
    await page.getByRole("button", { name: /usar esta organização/i }).click();
    await page.waitForURL(/\/onboarding\/follow-up/, { timeout: 30_000 });

    const { data: funil } = await svc
      .from("crm_pipelines")
      .select("id, name")
      .eq("organization_id", orgId)
      .eq("is_default", true)
      .maybeSingle();

    const { data: etapas } = await svc
      .from("crm_stages")
      .select("name, agent_stage_hint, is_won, is_lost")
      .eq("pipeline_id", funil!.id)
      .order("position");

    const nomes = (etapas ?? []).map((e) => String(e.name));
    // O quadro que o gatilho semeia em TODA organização, num produto que se
    // vende como multi-nicho: a clínica abria o quadro dela e lia isto.
    expect(nomes).not.toContain("Carrinho abandonado");
    expect(nomes).not.toContain("Em separação");
    expect(String(funil!.name)).not.toBe("Pedidos");

    // A metade invisível: sem destino, o funcionário tem o funil no escopo e
    // não sabe o que significa nenhuma coluna.
    const comDestino = (etapas ?? []).filter((e) => e.agent_stage_hint !== null);
    expect(comDestino.length).toBeGreaterThanOrEqual(5);
    // Uma de ganho e uma de perda, e o destino delas COERENTE com a marcação —
    // é o que o CHECK `crm_stages_hint_coerente_com_won_lost` cobra.
    expect((etapas ?? []).filter((e) => e.is_won)).toHaveLength(1);
    expect((etapas ?? []).filter((e) => e.is_lost)).toHaveLength(1);
    for (const e of etapas ?? []) {
      expect(e.is_won, String(e.name)).toBe(e.agent_stage_hint === "won");
      expect(e.is_lost, String(e.name)).toBe(e.agent_stage_hint === "lost");
    }
  });

  test("lembrete e IA: opt-in, COPILOT, sem publicar agente", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/follow-up/, { timeout: 30_000 });
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/setup-ai/, { timeout: 30_000 });

    await expect(page.getByText("Assistente IA")).toBeVisible();
    await page.getByText("Assistente IA").click();
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/invite-team/, { timeout: 30_000 });

    const { data: org } = await svc
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .maybeSingle();
    const settings = (org?.settings ?? {}) as { ai_mode?: string; perfil_do_negocio?: { id?: string } };
    expect(settings.ai_mode).toBe("copilot");
    expect(settings.perfil_do_negocio?.id).toBe("servicos");

    const { data: agentes } = await svc
      .from("ai_agents")
      .select("id, published_version_id")
      .eq("organization_id", orgId);
    expect(agentes ?? []).toHaveLength(0);
  });

  test("o wizard termina apresentando o sistema, e o resumo não acusa passo inexistente", async ({
    page,
  }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/invite-team/, { timeout: 30_000 });
    await page.getByRole("button", { name: /pular por enquanto/i }).click();
    await page.waitForURL(/\/onboarding\/done/, { timeout: 30_000 });

    // O tour: as peças apresentadas pelo que fazem.
    await expect(page.getByText(/o que mais tem aqui/i)).toBeVisible();
    await expect(page.getByText(/voltar a falar com quem sumiu/i)).toBeVisible();

    // A integração de loja vem desligada: o passo não existe nesta instalação,
    // e o resumo listava "Loja Nuvemshop (pulado)" — acusando a pessoa de não
    // fazer o que ninguém lhe ofereceu.
    await expect(page.locator("body")).not.toContainText(/Nuvemshop/i);

    await page.getByRole("button", { name: /começar a usar/i }).click();
    await page.waitForURL(/\/app\//, { timeout: 30_000 });

    const { data: org } = await svc
      .from("organizations")
      .select("onboarded_at, display_name")
      .eq("id", orgId)
      .maybeSingle();
    expect(org?.onboarded_at).toBeTruthy();
    expect(org?.display_name).toBe("Clínica Bem Viver");
  });
});

type ContaWizard = { email: string; userId: string; orgId: string };

async function criarContaWizard(prefixo: string): Promise<ContaWizard> {
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

async function apagarContaWizard(conta: ContaWizard | null): Promise<void> {
  if (!conta) return;
  if (conta.orgId) {
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
  }
  if (conta.userId) await svc.auth.admin.deleteUser(conta.userId);
}

async function loginNaConta(page: Page, emailDaConta: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(emailDaConta);
  await page.locator("#password").fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
}

test.describe("Ready Model Locação / máquinas — Simple Mode OFF", () => {
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  let conta: ContaWizard | null = null;

  test.beforeAll(async () => {
    conta = await criarContaWizard("locacao");
  });

  test.afterAll(async () => {
    await apagarContaWizard(conta);
  });

  test("wizard: Locação + máquinas + follow-up + Sem IA, sem publicar agente", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    await loginNaConta(page, conta.email);
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

    await expect(page.locator("body")).toContainText("Cotação / Proposta");
    await expect(page.locator("body")).toContainText("Fechamento");
    await page.getByRole("button", { name: /usar esta organização/i }).click();
    await page.waitForURL(/\/onboarding\/follow-up/, { timeout: 30_000 });

    await page.locator('input[name="ativo"][value="sim"]').click();
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/setup-ai/, { timeout: 30_000 });

    await page.locator('input[name="ai_mode"][value="off"]').click();
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/invite-team/, { timeout: 30_000 });
    await page.getByRole("button", { name: /pular por enquanto/i }).click();
    await page.waitForURL(/\/onboarding\/done/, { timeout: 30_000 });
    await page.getByRole("button", { name: /começar a usar/i }).click();
    await page.waitForURL(/\/app\//, { timeout: 30_000 });

    const { data: org } = await svc
      .from("organizations")
      .select("settings, onboarded_at")
      .eq("id", conta.orgId)
      .maybeSingle();
    const settings = (org?.settings ?? {}) as {
      ai_mode?: string;
      perfil_do_negocio?: { id?: string; version?: string; subtype?: string };
    };
    expect(org?.onboarded_at).toBeTruthy();
    expect(settings.ai_mode).toBe("off");
    expect(settings.perfil_do_negocio?.id).toBe("locacao");
    expect(settings.perfil_do_negocio?.version).toBe("1.0");
    expect(settings.perfil_do_negocio?.subtype).toBe("maquinas_e_equipamentos");

    const { data: funil } = await svc
      .from("crm_pipelines")
      .select("id, name, settings")
      .eq("organization_id", conta.orgId)
      .eq("is_default", true)
      .maybeSingle();
    expect(String(funil!.name)).toBe("Atendimento");
    const fields = ((funil?.settings as { fields?: Array<{ key: string; label: string }> } | null)?.fields ??
      []) as Array<{ key: string; label: string }>;
    const item = fields.find((f) => f.key === "item_tipo");
    expect(item?.label).toBe("Equipamento");

    const { data: agentes } = await svc
      .from("ai_agents")
      .select("id, published_version_id")
      .eq("organization_id", conta.orgId);
    expect(agentes ?? []).toHaveLength(0);

    const { data: pointers } = await svc
      .from("followup_flow_pointers")
      .select("name, status")
      .eq("organization_id", conta.orgId);
    expect((pointers ?? []).some((p) => p.name === "rm:locacao:silencio-24h")).toBe(true);
  });

  test("follow-up determinístico enrolla sem agente publicado", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    const { data: contato, error: errContato } = await svc
      .from("contacts")
      .insert({ organization_id: conta.orgId, display_name: "Cliente silencioso" })
      .select("id")
      .single();
    if (errContato || !contato) throw errContato ?? new Error("sem contato");

    const { data: sessao, error: errSessao } = await svc
      .from("channel_sessions")
      .insert({
        organization_id: conta.orgId,
        waha_session_name: `e2e-locacao-${randomUUID().slice(0, 8)}`,
        webhook_secret_encrypted: "\\x00",
      } as never)
      .select("id")
      .single();
    if (errSessao || !sessao) throw errSessao ?? new Error("sem sessão");

    const silenciosDesde = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const { error: errConv } = await svc.from("conversations").insert({
      organization_id: conta.orgId,
      contact_id: contato.id,
      channel_session_id: sessao.id,
      status: "open",
      is_group: false,
      last_inbound_at: silenciosDesde,
    });
    if (errConv) throw errConv;

    const tick = await page.request.post("/api/v1/cron/followup-flow-worker", {
      headers: {
        authorization: `Bearer ${process.env.INTERNAL_CRON_SECRET ?? process.env.INTERNAL_SECRET ?? "e2e-placeholder-nao-e-segredo"}`,
      },
    });
    expect(tick.ok(), `tick do sweep: ${tick.status()} ${await tick.text()}`).toBe(true);

    const { data: enrollments } = await svc
      .from("followup_enrollments")
      .select("id, agent_id, status")
      .eq("organization_id", conta.orgId)
      .eq("contact_id", contato.id);
    expect(enrollments ?? []).toHaveLength(1);
    expect(enrollments![0]!.agent_id).toBeNull();
    expect(enrollments![0]!.status).toBe("active");

    const { data: runs } = await svc.from("ai_agent_runs").select("id").eq("organization_id", conta.orgId);
    expect(runs ?? []).toHaveLength(0);
  });
});

test.describe("Ready Model Advocacia — Simple Mode OFF", () => {
  test.describe.configure({ timeout: 120_000 });

  let conta: ContaWizard | null = null;

  test.beforeAll(async () => {
    conta = await criarContaWizard("advocacia");
  });

  test.afterAll(async () => {
    await apagarContaWizard(conta);
  });

  test("mesmo instalador, pipeline jurídico, sem artefato de locação nem agente", async ({ page }) => {
    if (!conta) throw new Error("sem conta");
    await loginNaConta(page, conta.email);
    await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });

    await page.locator("#display_name").fill("Escritório Norte");
    await page.getByText("Advocacia", { exact: true }).click();
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 30_000 });

    await page.getByRole("button", { name: /pular por enquanto/i }).click();
    await page.waitForURL(/\/onboarding\/quem-atende/, { timeout: 30_000 });
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/funil/, { timeout: 30_000 });

    await expect(page.locator("body")).toContainText("Triagem");
    await expect(page.locator("body")).toContainText("Contratação");
    await expect(page.locator("body")).not.toContainText("Cotação / Proposta");
    await page.getByRole("button", { name: /usar esta organização/i }).click();
    await page.waitForURL(/\/onboarding\/follow-up/, { timeout: 30_000 });

    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/setup-ai/, { timeout: 30_000 });
    await page.locator('input[name="ai_mode"][value="off"]').click();
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/invite-team/, { timeout: 30_000 });
    await page.getByRole("button", { name: /pular por enquanto/i }).click();
    await page.waitForURL(/\/onboarding\/done/, { timeout: 30_000 });
    await page.getByRole("button", { name: /começar a usar/i }).click();
    await page.waitForURL(/\/app\//, { timeout: 30_000 });

    const { data: org } = await svc.from("organizations").select("settings").eq("id", conta.orgId).maybeSingle();
    const settings = (org?.settings ?? {}) as {
      ai_mode?: string;
      perfil_do_negocio?: { id?: string };
    };
    expect(settings.ai_mode).toBe("off");
    expect(settings.perfil_do_negocio?.id).toBe("advocacia");

    const { data: funil } = await svc
      .from("crm_pipelines")
      .select("name, settings")
      .eq("organization_id", conta.orgId)
      .eq("is_default", true)
      .maybeSingle();
    expect(String(funil!.name)).toBe("Novos clientes");
    const fields = ((funil?.settings as { fields?: Array<{ key: string }> } | null)?.fields ?? []) as Array<{
      key: string;
    }>;
    expect(fields.some((f) => f.key === "item_tipo")).toBe(false);
    expect(fields.some((f) => f.key === "area_juridica")).toBe(true);

    const { data: pointers } = await svc
      .from("followup_flow_pointers")
      .select("name")
      .eq("organization_id", conta.orgId);
    expect((pointers ?? []).some((p) => String(p.name).includes("locacao"))).toBe(false);

    const { data: moope } = await svc.from("moope_connections").select("id").eq("organization_id", conta.orgId);
    expect(moope ?? []).toHaveLength(0);

    const { data: agentes } = await svc.from("ai_agents").select("id").eq("organization_id", conta.orgId);
    expect(agentes ?? []).toHaveLength(0);
  });
});
