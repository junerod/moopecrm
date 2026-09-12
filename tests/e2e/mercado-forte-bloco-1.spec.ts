/**
 * Mercado Forte — Bloco 1: multiatendimento utilizável.
 * Prova pela tela. Não gera QR. Não toca sessão WAHA real.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const SHOTS = path.join(process.cwd(), "docs/mercado-forte-bloco-1/screenshots");

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
let conversaMaria = "";
let conversaJoao = "";
let conversaFila = "";
let conversaMeta = "";
let contatoFilaNome = "";
let leadId = "";
let pipelineId = "";
const SUFIXO = String(Date.now()).slice(-8);

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

async function garantirSessao(provider: "waha" | "meta_cloud"): Promise<string> {
  const nome = `e2e-mf-${provider}-${SUFIXO}`;
  const row =
    provider === "meta_cloud"
      ? {
          organization_id: creds.org_id,
          webhook_secret_encrypted: "e2e",
          provider,
          meta_phone_number_id: `e2e-meta-${SUFIXO}`,
        }
      : {
          organization_id: creds.org_id,
          webhook_secret_encrypted: "e2e",
          provider,
          waha_session_name: nome,
        };
  const { data, error } = await admin.from("channel_sessions").insert(row).select("id").single();
  if (error || !data) throw new Error(`sessão ${provider}: ${error?.message}`);
  return (data as { id: string }).id;
}

let telSeq = 0;
async function criarContato(nome: string): Promise<string> {
  telSeq += 1;
  const { data, error } = await admin
    .from("contacts")
    .insert({
      organization_id: creds.org_id,
      display_name: nome,
      phone_number: `+55119${SUFIXO}${telSeq}`.slice(0, 15),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`contato: ${error?.message}`);
  return (data as { id: string }).id;
}

async function criarConversa(opts: {
  contatoId: string;
  sessao: string;
  preview: string;
  lastInboundAt?: string;
}): Promise<string> {
  const { data, error } = await admin
    .from("conversations")
    .insert({
      organization_id: creds.org_id,
      contact_id: opts.contatoId,
      channel_session_id: opts.sessao,
      status: "open",
      last_message_preview: opts.preview,
      last_message_at: new Date().toISOString(),
      last_inbound_at: opts.lastInboundAt ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`conversa: ${error?.message}`);
  return (data as { id: string }).id;
}

test.describe("Mercado Forte — Bloco 1", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    if (!fs.existsSync(CREDS_PATH)) {
      execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
    }
    creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
    sessaoId = await garantirSessao("waha");
    const sessaoMeta = await garantirSessao("meta_cloud");

    const joao = creds.users.agent!;
    const maria = creds.users.manager!;

    const cMaria = await criarContato(`MF Maria ${SUFIXO}`);
    const cJoao = await criarContato(`MF João ${SUFIXO}`);
    contatoFilaNome = `MF Fila ${SUFIXO}`;
    const cFila = await criarContato(contatoFilaNome);
    const cMeta = await criarContato(`MF HSM ${SUFIXO}`);

    conversaMaria = await criarConversa({
      contatoId: cMaria,
      sessao: sessaoId,
      preview: "Conversa da Maria",
    });
    conversaJoao = await criarConversa({
      contatoId: cJoao,
      sessao: sessaoId,
      preview: "Conversa do João",
    });
    conversaFila = await criarConversa({
      contatoId: cFila,
      sessao: sessaoId,
      preview: "Esperando na fila",
      lastInboundAt: new Date("2015-01-01T00:00:00.000Z").toISOString(),
    });
    conversaMeta = await criarConversa({
      contatoId: cMeta,
      sessao: sessaoMeta,
      preview: "Janela fechada",
      lastInboundAt: new Date(Date.now() - 30 * 60 * 60_000).toISOString(),
    });

    await admin.rpc("fn_conversation_assign", {
      p_organization_id: creds.org_id,
      p_conversation_id: conversaMaria,
      p_to_user_id: maria.id,
      p_reason: "claim",
      p_expected_assignee: null,
      p_enforce_expected: false,
    });
    await admin.rpc("fn_conversation_assign", {
      p_organization_id: creds.org_id,
      p_conversation_id: conversaJoao,
      p_to_user_id: joao.id,
      p_reason: "claim",
      p_expected_assignee: null,
      p_enforce_expected: false,
    });

    await admin.from("message_templates").insert({
      organization_id: creds.org_id,
      title: `Saudação MF ${SUFIXO}`,
      body: "Olá, aqui é o time. Como posso ajudar?",
      shortcut: `oi${SUFIXO.slice(-3)}`,
    });

    const { data: funil } = await admin
      .from("crm_pipelines")
      .select("id, crm_stages(id)")
      .eq("organization_id", creds.org_id)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();
    pipelineId = (funil as { id: string } | null)?.id ?? "";
    const etapaId = (funil as { crm_stages?: Array<{ id: string }> } | null)?.crm_stages?.[0]?.id;
    if (pipelineId && etapaId) {
      const { data: lead } = await admin
        .from("crm_leads")
        .insert({
          organization_id: creds.org_id,
          contact_id: cFila,
          pipeline_id: pipelineId,
          stage_id: etapaId,
          title: `Lead quente MF ${SUFIXO}`,
          temperatura: "quente",
        })
        .select("id")
        .single();
      leadId = (lead as { id: string } | null)?.id ?? "";
    }
  });

  test("A–E owner, colisão, histórico e transferência", async ({ page }) => {
    const maria = creds.users.manager!;
    const joao = creds.users.agent!;
    await login(page, maria.email);

    await page.goto(`/app/inbox/${conversaMaria}`);
    await expect(page.getByTestId("rotulo-do-dono")).toContainText("Você está atendendo", {
      timeout: 30_000,
    });
    await shot(page, "01-inbox-minhas.png");

    await page.goto(`/app/inbox/${conversaJoao}`);
    await expect(page.getByTestId("rotulo-do-dono")).toContainText(/está atendendo/, {
      timeout: 30_000,
    });
    await expect(page.getByTestId("collision-banner")).toBeVisible();
    await expect(page.getByTestId("inbox-composer")).toBeDisabled();
    await shot(page, "03-owner-outro-atendente.png");
    await shot(page, "04-collision-warning.png");

    await page.getByTestId("assignment-history").click();
    await expect(page.getByTestId("assignment-history")).toContainText(/assumiu/i);
    await shot(page, "06-assignment-history.png");

    const envio = await page.request.post("/api/v1/messages", {
      data: { conversation_id: conversaJoao, body: "não deveria sair", type: "text" },
    });
    expect(envio.status()).toBe(403);

    await page.getByTestId("collision-assumir").click();
    await expect(page.getByTestId("rotulo-do-dono")).toContainText("Você está atendendo", {
      timeout: 30_000,
    });

    await page.goto(`/app/inbox/${conversaMaria}`);
    await page.getByRole("button", { name: /Transferir/i }).first().click();
    await expect(page.getByTestId("transfer-dialog")).toBeVisible();
    await shot(page, "05-transfer-dialog.png");
    await page.locator("#reassign-target").click();
    await page.getByRole("option", { name: /E2E Agent/i }).click();
    await page.getByRole("button", { name: /^Transferir$/i }).click();
    await expect(page.getByTestId("rotulo-do-dono")).toContainText(/E2E Agent está atendendo/, {
      timeout: 30_000,
    });

    await page.context().clearCookies();
    await login(page, joao.email);
    await page.goto("/app/inbox?filter=mine");
    await expect(page.getByRole("button").filter({ hasText: `MF Maria ${SUFIXO}` })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("F fila mostra espera", async ({ page }) => {
    await login(page, creds.users.agent!.email);
    await page.goto("/app/inbox?filter=unassigned");
    await expect(page.getByTestId("queue-wait")).toBeVisible({ timeout: 30_000 });
    const naFila = page.getByRole("button").filter({ hasText: contatoFilaNome });
    await expect(naFila).toBeVisible({ timeout: 30_000 });
    await expect(naFila).toContainText(/Aguardando/i);
    await shot(page, "02-inbox-fila.png");
    await shot(page, "10-queue-wait.png");
  });

  test("I–J respostas rápidas e slash", async ({ page }) => {
    await login(page, creds.users.agent!.email);
    await page.goto(`/app/inbox/${conversaFila}`);
    await page.getByRole("button", { name: /^Assumir$/i }).click();
    await expect(page.getByTestId("rotulo-do-dono")).toContainText("Você está atendendo", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("inbox-composer")).toBeEnabled();
    await page.getByTestId("quick-replies").click();
    await expect(page.getByTestId("quick-replies-menu")).toBeVisible();
    await expect(page.getByTestId("quick-replies-menu").getByText(`Saudação MF ${SUFIXO}`)).toBeVisible();
    await shot(page, "07-quick-replies.png");
    await page.getByTestId("quick-replies-menu").getByText(`Saudação MF ${SUFIXO}`).click();
    await expect(page.getByTestId("inbox-composer")).toHaveValue(/Como posso ajudar/);

    await page.getByTestId("inbox-composer").fill(`/${`oi${SUFIXO.slice(-3)}`}`);
    await expect(page.getByTestId("quick-replies-menu")).toBeVisible();
    await shot(page, "08-slash-templates.png");
  });

  test("K–L HSM contextual; WAHA não quebra", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto(`/app/inbox/${conversaMeta}`);
    await expect(page.getByTestId("hsm-required")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("hsm-required")).toContainText(/modelo aprovado/i);
    await shot(page, "09-hsm-required.png");

    await page.goto(`/app/inbox/${conversaFila}`);
    await expect(page.getByTestId("hsm-required")).toHaveCount(0);
  });

  test("M nota interna continua descoberta", async ({ page }) => {
    await login(page, creds.users.agent!.email);
    await page.goto(`/app/inbox/${conversaFila}`);
    await page.getByRole("button", { name: /Nota interna/i }).click();
    await expect(page.getByTestId("inbox-composer")).toBeVisible();
    await shot(page, "13-note-internal.png");
  });

  test("N temperatura no Kanban", async ({ page }) => {
    test.skip(!pipelineId || !leadId, "org sem funil");
    await login(page, creds.users.manager!.email);
    await page.goto(`/app/pipelines/${pipelineId}`);
    await expect(page.getByTestId("kanban-temperatura").first()).toContainText(/Quente/i, {
      timeout: 30_000,
    });
    await shot(page, "12-kanban-temperatura.png");
  });

  test("H–I round-robin descobrível; manual permanece", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/settings/atendimento");
    await expect(page.getByTestId("form-atendimento")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("opcao-modo-manual")).toBeVisible();
    await expect(page.getByTestId("opcao-modo-round_robin")).toBeVisible();
    await expect(page.getByTestId("opcao-modo-round_robin")).toContainText("Automática");
    await page.getByTestId("opcao-modo-round_robin").click();
    await expect(page.getByTestId("round-robin-participantes")).toBeVisible();
    await shot(page, "11-round-robin-settings.png");
    await page.getByTestId("opcao-modo-manual").click();
  });

  test("P tenant isolation: org B não lê histórico da org A", async ({ page }) => {
    const { data: orgB, error } = await admin
      .from("organizations")
      .insert({
        slug: `e2e-mf-b-${SUFIXO}`,
        legal_name: "Org B MF",
        display_name: "Org B MF",
      })
      .select("id")
      .single();
    if (error || !orgB) throw new Error(`org B: ${error?.message}`);
    const orgBId = (orgB as { id: string }).id;
    await page.context().clearCookies();
    await login(page, creds.users.manager!.email);
    const hist = await page.request.get(`/api/v1/conversations/${conversaJoao}/assignment-events`);
    expect(hist.status()).toBe(200);
    const fila = await page.request.get("/api/v1/conversations/queue-status");
    expect(fila.status()).toBe(200);
    const corpo = (await fila.json()) as { data: { queue_size: number } };
    expect(typeof corpo.data.queue_size).toBe("number");

    const { data: contatoB } = await admin
      .from("contacts")
      .insert({
        organization_id: orgBId,
        display_name: "Segredo B",
        phone_number: `+55118${SUFIXO}`,
      })
      .select("id")
      .single();
    const { data: sessaoB } = await admin
      .from("channel_sessions")
      .insert({
        organization_id: orgBId,
        waha_session_name: `e2e-mf-b-${SUFIXO}`,
        webhook_secret_encrypted: "e2e",
      })
      .select("id")
      .single();
    const { data: convB } = await admin
      .from("conversations")
      .insert({
        organization_id: orgBId,
        contact_id: (contatoB as { id: string }).id,
        channel_session_id: (sessaoB as { id: string }).id,
        status: "open",
      })
      .select("id")
      .single();
    const vazou = await page.request.get(
      `/api/v1/conversations/${(convB as { id: string }).id}/assignment-events`,
    );
    expect(vazou.status()).toBe(404);
    await admin.from("organizations").delete().eq("id", orgBId);
  });

  test("Q mobile 390", async ({ page }) => {
    const maria = creds.users.manager!;
    const joao = creds.users.agent!;
    // Autocontido: não depende da ordem dos testes anteriores.
    await admin.rpc("fn_conversation_assign", {
      p_organization_id: creds.org_id,
      p_conversation_id: conversaMaria,
      p_to_user_id: joao.id,
      p_reason: "transfer",
      p_expected_assignee: null,
      p_enforce_expected: false,
    });
    await admin.rpc("fn_conversation_assign", {
      p_organization_id: creds.org_id,
      p_conversation_id: conversaJoao,
      p_to_user_id: maria.id,
      p_reason: "claim",
      p_expected_assignee: null,
      p_enforce_expected: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, maria.email);
    await page.goto("/app/inbox?filter=mine");
    await expect(page.getByRole("button").filter({ hasText: /MF / }).first()).toBeVisible({
      timeout: 30_000,
    });
    await shot(page, "14-mobile-inbox.png");
    await page.goto(`/app/inbox/${conversaMaria}`);
    await expect(page.getByTestId("collision-banner")).toBeVisible({ timeout: 30_000 });
    await shot(page, "15-mobile-collision.png");
    await page.goto(`/app/inbox/${conversaJoao}`);
    await expect(page.getByTestId("quick-replies")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("quick-replies").click();
    await expect(page.getByTestId("quick-replies-menu")).toBeVisible();
    await shot(page, "16-mobile-quick-replies.png");
    await page.getByTestId("quick-replies").click();
    await expect(page.getByTestId("quick-replies-menu")).toHaveCount(0);
    await page.getByRole("button", { name: /Nota interna/i }).click();
    await shot(page, "17-mobile-note.png");
  });
});
