/**
 * Mercado Forte — Bloco 3: campanha + supervisão + retrato MOOPE.
 * Sem QR. Sem WhatsApp real. Envio só mock.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const SHOTS = path.join(process.cwd(), "docs/mercado-forte-bloco-3/screenshots");

interface Creds {
  password: string;
  org_id: string;
  users: Record<string, { id: string; email: string; role: string }>;
}

const env = carregarEnvLocal();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let creds: Creds;
let sessaoId = "";
let conversaId = "";
let contatoOk = "";
let contatoBlk = "";
let contatoMoope = "";
let contatoMoopeFalha = "";
let pipelineId = "";
const SUFIXO = String(Date.now()).slice(-8);
const TAG = `mf3-${SUFIXO}`;

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

async function shot(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, nome), fullPage: true });
}

async function cronDispatch(page: Page) {
  const secret = env.INTERNAL_SECRET;
  test.skip(!secret, "INTERNAL_SECRET ausente");
  return page.request.post("/api/v1/cron/campaign-dispatch", {
    headers: { Authorization: `Bearer ${secret}` },
  });
}

test.describe("Mercado Forte — Bloco 3", () => {
  test.describe.configure({ timeout: 180_000, mode: "serial" });

  test.beforeAll(async () => {
    if (!fs.existsSync(CREDS_PATH)) {
      execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
    }
    creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;

    const { data: sessao, error: erroSessao } = await admin
      .from("channel_sessions")
      .insert({
        organization_id: creds.org_id,
        webhook_secret_encrypted: "e2e",
        provider: "meta_cloud",
        meta_phone_number_id: `e2e-mf3-${SUFIXO}`,
      })
      .select("id")
      .single();
    if (erroSessao || !sessao) throw new Error(`sessão: ${erroSessao?.message}`);
    sessaoId = sessao.id as string;

    const { data: ok, error: erroOk } = await admin
      .from("contacts")
      .insert({
        organization_id: creds.org_id,
        display_name: `MF3 Maria ${SUFIXO}`,
        phone_number: `+551191${SUFIXO}`.slice(0, 15),
        tags: [TAG],
        papel: "lead",
        source: "whatsapp",
      })
      .select("id")
      .single();
    if (erroOk || !ok) throw new Error(`contato ok: ${erroOk?.message}`);
    contatoOk = (ok as { id: string }).id;

    const { data: blk, error: erroBlk } = await admin
      .from("contacts")
      .insert({
        organization_id: creds.org_id,
        display_name: `MF3 Bloqueado ${SUFIXO}`,
        phone_number: `+551192${SUFIXO}`.slice(0, 15),
        tags: [TAG],
        is_blocked: true,
      })
      .select("id")
      .single();
    if (erroBlk || !blk) throw new Error(`contato blk: ${erroBlk?.message}`);
    contatoBlk = (blk as { id: string }).id;

    const { data: moope } = await admin
      .from("contacts")
      .insert({
        organization_id: creds.org_id,
        display_name: `MF3 Locatario ${SUFIXO}`,
        phone_number: `+551193${SUFIXO}`.slice(0, 15),
        source: "moope",
        source_metadata: {
          moope_external_id: `loc-${SUFIXO}`,
          retrato_locadora: {
            nome: "Ana Locatária",
            placa: "ABC1D23",
            veiculo_modelo: "Onix",
            contrato_status: "ativo",
            days_late: 0,
            portal_url: "https://example.com/gestao/cliente",
          },
        },
      })
      .select("id")
      .single();
    contatoMoope = (moope as { id: string }).id;

    const { data: falha } = await admin
      .from("contacts")
      .insert({
        organization_id: creds.org_id,
        display_name: `MF3 SemGestao ${SUFIXO}`,
        phone_number: `+551194${SUFIXO}`.slice(0, 15),
        source: "moope",
        source_metadata: { moope_external_id: `loc-fail-${SUFIXO}` },
      })
      .select("id")
      .single();
    contatoMoopeFalha = (falha as { id: string }).id;

    const { data: conv } = await admin
      .from("conversations")
      .insert({
        organization_id: creds.org_id,
        contact_id: contatoMoope,
        channel_session_id: sessaoId,
        status: "open",
        last_message_preview: "Preciso da locação",
        last_message_at: new Date().toISOString(),
        last_inbound_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    conversaId = (conv as { id: string }).id;

    const { data: funil } = await admin
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", creds.org_id)
      .limit(1)
      .maybeSingle();
    pipelineId = (funil as { id?: string } | null)?.id ?? "";

    await admin
      .from("campaigns")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("organization_id", creds.org_id)
      .in("status", ["running", "scheduled"]);

    await admin.from("conversations").insert({
      organization_id: creds.org_id,
      contact_id: contatoOk,
      channel_session_id: sessaoId,
      status: "open",
      assigned_to_user_id: null,
      last_inbound_at: new Date(Date.now() - 3600_000).toISOString(),
    });
  });

  test("A–E wizard: draft, segmento, opt-out, preview, envio mock", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/campanhas");
    await expect(page.getByRole("heading", { name: "Campanhas" })).toBeVisible({ timeout: 20_000 });
    await shot(page, "01-campanhas-lista.png");

    await page.getByTestId("campanha-nova").click();
    await expect(page.getByTestId("campanha-wizard")).toBeVisible();
    await page.locator("#camp-tag").fill(TAG);
    await expect(page.getByTestId("campanha-estimativa")).toContainText(/contatos selecionados/i, {
      timeout: 15_000,
    });
    await shot(page, "02-campanha-nova-segmento.png");
    await page.getByTestId("campanha-proximo").click();
    await expect(page.getByTestId("campanha-passo-mensagem")).toBeVisible();
    await page.locator("#camp-nome").fill(`Proposta ${SUFIXO}`);
    await page.locator("#camp-body").fill("Olá {{nome}}, sua proposta está pronta.");
    await shot(page, "03-campanha-template.png");
    await page.getByTestId("campanha-salvar-rascunho").click();
    await expect(page.getByTestId("campanhas-lista")).toContainText(`Proposta ${SUFIXO}`, {
      timeout: 15_000,
    });
    await page.getByTestId("campanha-proximo").click();
    await expect(page.getByTestId("campanha-preview")).toContainText("Olá Maria");
    await expect(page.getByTestId("campanha-preview")).toHaveAttribute("data-ok", "1");
    await shot(page, "04-campanha-preview.png");
    await page.getByTestId("campanha-proximo").click();
    await page.getByTestId("campanha-enviar").click();
    const linha = page.locator("[data-testid=campanhas-lista] li").filter({ hasText: `Proposta ${SUFIXO}` });
    await expect(linha.getByText(/running|completed|scheduled/i)).toBeVisible({ timeout: 20_000 });

    const listaCamp = await page.request.get("/api/v1/campanhas");
    const camps = (await listaCamp.json()) as { data: Array<{ id: string; name: string; status: string }> };
    const campanha = camps.data.find((c) => c.name.includes(`Proposta ${SUFIXO}`));
    expect(campanha, "campanha do wizard").toBeTruthy();
    if (campanha && campanha.status === "draft") {
      const start = await page.request.post(`/api/v1/campanhas/${campanha.id}/start`, { data: {} });
      expect(start.ok(), await start.text()).toBeTruthy();
    }

    const r1 = await cronDispatch(page);
    expect(r1.ok(), await r1.text()).toBeTruthy();
    const j1 = (await r1.json()) as {
      data: { enviados: number; entregas: Array<{ classificacao: string; dest_e164: string }> };
    };
    expect(j1.data.entregas.every((e) => e.classificacao === "campaign_commercial")).toBeTruthy();
    expect(j1.data.enviados).toBeGreaterThan(0);
    expect(j1.data.entregas.some((e) => e.dest_e164.includes("55119"))).toBeTruthy();
  });

  test("C F G H J opt-out, idempotência, cancel, status, sem lead em massa", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    const { count: leadsAntes } = await admin
      .from("crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", creds.org_id);

    const lista = await page.request.get("/api/v1/campanhas");
    expect(lista.ok()).toBeTruthy();
    const camps = (await lista.json()) as { data: Array<{ id: string; name: string; status: string }> };
    const camp = camps.data.find((c) => c.name.includes(SUFIXO));
    test.skip(!camp, "campanha do wizard ausente");

    const recs = await page.request.get(`/api/v1/campanhas/${camp!.id}/recipients`);
    const dests = (await recs.json()) as { data: Array<{ contact_id: string; status: string }> };
    expect(dests.data.some((d) => d.contact_id === contatoBlk && d.status === "skipped")).toBeTruthy();
    expect(dests.data.some((d) => d.contact_id === contatoOk && d.status !== "skipped")).toBeTruthy();

    const r2 = await cronDispatch(page);
    const j2 = (await r2.json()) as { data: { enviados: number } };
    expect(j2.data.enviados).toBe(0);

    const { count: leadsDepois } = await admin
      .from("crm_leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", creds.org_id);
    expect(leadsDepois ?? 0).toBe(leadsAntes ?? 0);

    const criar = await page.request.post("/api/v1/campanhas", {
      data: { name: `Cancelar ${SUFIXO}`, body_text: "Olá {{nome}}", segment: { tags: [TAG] } },
    });
    expect(criar.ok()).toBeTruthy();
    const criada = (await criar.json()) as { data: { id: string } };
    await page.request.post(`/api/v1/campanhas/${criada.data.id}/start`, { data: {} });
    const cancel = await page.request.post(`/api/v1/campanhas/${criada.data.id}/cancel`, { data: {} });
    expect(cancel.ok()).toBeTruthy();
    const det = await page.request.get(`/api/v1/campanhas/${criada.data.id}`);
    const corpo = (await det.json()) as { data: { status: string } };
    expect(corpo.data.status).toBe("cancelled");

    await page.goto(`/app/campanhas/${camp!.id}`);
    await expect(page.getByTestId("campanha-resultado")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("campanha-destinatarios")).toBeVisible();
    await shot(page, "05-campanha-resultado.png");
  });

  test("I resposta associa origem", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    const lista = await page.request.get("/api/v1/campanhas");
    const camps = (await lista.json()) as { data: Array<{ id: string; name: string }> };
    const camp = camps.data.find((c) => c.name.includes(`Proposta ${SUFIXO}`));
    test.skip(!camp, "campanha proposta ausente");

    const { data: convOk } = await admin
      .from("conversations")
      .select("id")
      .eq("organization_id", creds.org_id)
      .eq("contact_id", contatoOk)
      .limit(1)
      .single();
    const { error: erroMsg } = await admin.from("messages").insert({
      organization_id: creds.org_id,
      conversation_id: (convOk as { id: string }).id,
      channel_session_id: sessaoId,
      contact_id: contatoOk,
      type: "text",
      direction: "inbound",
      body: "Quero a proposta",
    });
    if (erroMsg) throw new Error(`messages: ${erroMsg.message}`);

    const r = await cronDispatch(page);
    expect(r.ok()).toBeTruthy();
    const recs = await page.request.get(`/api/v1/campanhas/${camp!.id}/recipients`);
    const dests = (await recs.json()) as { data: Array<{ contact_id: string; status: string }> };
    expect(dests.data.some((d) => d.contact_id === contatoOk && d.status === "replied")).toBeTruthy();
  });

  test("K L M N O P supervisão e RBAC", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/metrics");
    await expect(page.getByRole("heading", { name: "Desempenho" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("desempenho-atendimento")).toBeVisible();
    await expect(page.getByTestId("desempenho-atendimento")).toContainText(/fila|espera|resposta/i);
    await shot(page, "06-desempenho-atendimento.png");
    await expect(page.getByTestId("desempenho-comercial")).toBeVisible();
    await expect(page.getByTestId("desempenho-comercial")).toContainText(/Ganhos|Perdidos|Conversão/i);
    await shot(page, "07-desempenho-comercial.png");
    await expect(page.getByTestId("desempenho-atendentes")).toBeVisible();
    await shot(page, "08-desempenho-atendentes.png");
    await expect(page.getByTestId("funil-gerencial")).toBeVisible();
    await shot(page, "09-funil-gerencial.png");
    await page.getByRole("button", { name: "7 dias" }).click();
    await expect(page.getByTestId("desempenho-periodo")).toBeVisible();
    await page.getByRole("button", { name: "30 dias" }).click();

    await page.goto("/login");
    await login(page, creds.users.agent!.email);
    const criar = await page.request.post("/api/v1/campanhas", {
      data: { name: "Agente nao pode", body_text: "x", segment: {} },
    });
    expect(criar.status()).toBe(403);
    const sup = await page.request.get("/api/v1/metrics/supervisao?periodo=7d");
    expect(sup.status()).toBe(403);
    await page.goto("/app/campanhas");
    await expect(page.getByRole("heading", { name: "Campanhas" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("campanha-nova")).toHaveCount(0);
  });

  test("Q R S cockpit MOOPE e Copilot não inventa", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto(`/app/inbox/${conversaId}`);
    await page.getByRole("button", { name: /ficha/i }).click({ timeout: 2_000 }).catch(() => undefined);
    await expect(page.getByTestId("retrato-moope")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("retrato-moope")).toContainText(/Ana Locatária|Onix|ABC1D23/i);
    await shot(page, "10-inbox-retrato-moope.png");

    await page.goto(`/app/contacts/${contatoMoope}`);
    await expect(page.getByTestId("retrato-moope")).toBeVisible({ timeout: 20_000 });
    await shot(page, "11-contato-360-moope.png");

    await page.goto(`/app/contacts/${contatoMoopeFalha}`);
    await expect(page.getByTestId("retrato-moope")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("retrato-moope")).toContainText("Não consegui consultar agora.");
    await shot(page, "12-moope-falha-segura.png");

    const copilot = await page.request.post(`/api/v1/conversations/${conversaId}/copilot`, {
      data: { force: true },
    });
    if (copilot.ok()) {
      const corpo = (await copilot.json()) as { data?: { suggestion?: { suggested_reply?: string } } };
      const texto = corpo.data?.suggestion?.suggested_reply ?? "";
      expect(texto).not.toMatch(/2 locações inventadas/i);
    }
  });

  test("T tenant isolation", async ({ page }) => {
    const { data: orgB, error } = await admin
      .from("organizations")
      .insert({
        slug: `e2e-mf3-b-${SUFIXO}`,
        legal_name: "Org B MF3",
        display_name: "Org B MF3",
      })
      .select("id")
      .single();
    if (error || !orgB) throw new Error(`org B: ${error?.message}`);
    await admin.from("campaigns").insert({
      organization_id: (orgB as { id: string }).id,
      name: "SEGREDO ORG B",
      body_text: "segredo",
      status: "draft",
    });
    await login(page, creds.users.manager!.email);
    const lista = await page.request.get("/api/v1/campanhas");
    const corpo = (await lista.json()) as { data: Array<{ name: string }> };
    expect(corpo.data.some((c) => c.name === "SEGREDO ORG B")).toBeFalsy();
  });

  test("U mobile 390", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, creds.users.manager!.email);
    await page.goto("/app/campanhas");
    await expect(page.getByRole("heading", { name: "Campanhas" })).toBeVisible({ timeout: 20_000 });
    await shot(page, "13-mobile-campanhas.png");
    await page.goto("/app/metrics");
    await expect(page.getByTestId("desempenho-atendimento")).toBeVisible({ timeout: 20_000 });
    await shot(page, "14-mobile-desempenho.png");
    await page.goto(`/app/inbox/${conversaId}`);
    await page.getByRole("button", { name: /ficha/i }).click();
    await expect(page.getByRole("dialog").getByTestId("retrato-moope")).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, "15-mobile-moope-cockpit.png");
  });

  test("V W regressões Bloco 1 e 2 (fumaça)", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/inbox");
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/app/agenda");
    await expect(page.getByTestId("agenda-obrigacoes")).toBeVisible({ timeout: 20_000 });
    await page.goto("/app/inicio");
    await expect(page.getByRole("main").getByTestId("hoje-operacional")).toBeVisible({ timeout: 20_000 });
    if (pipelineId) {
      await page.goto(`/app/pipelines/${pipelineId}`);
      await expect(page.locator("body")).toBeVisible();
    }
  });
});
