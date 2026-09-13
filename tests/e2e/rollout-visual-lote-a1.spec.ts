/**
 * Lote A1 visual — Inbox + Kanban. Prova pela tela + capturas.
 * Não gera QR. Não toca sessão WAHA real.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const SHOTS_INBOX = path.join(process.cwd(), "docs/rollout-visual-lote-a1/screenshots/inbox");
const SHOTS_KANBAN = path.join(process.cwd(), "docs/rollout-visual-lote-a1/screenshots/kanban");

interface Creds {
  password: string;
  org_id: string;
  users: Record<string, { id: string; email: string }>;
}

const env = carregarEnvLocal();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function loadCreds(): Creds {
  if (!fs.existsSync(CREDS_PATH)) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
  }
  return JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
}

const creds = loadCreds();
const SUFIXO = String(Date.now()).slice(-8);
let conversaMinhaId = "";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

async function escolherTema(page: Page, tema: "light" | "dark"): Promise<void> {
  await page.getByTestId("theme-control").click();
  await page.getByTestId(`theme-option-${tema}`).click();
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.getAttribute("data-theme")))
    .toBe(tema);
}

async function shot(dir: string, page: Page, nome: string): Promise<void> {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, nome), fullPage: false });
}

test.describe("lote A1 visual — inbox e kanban", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    const { data: sessao, error: sessErr } = await admin
      .from("channel_sessions")
      .insert({
        organization_id: creds.org_id,
        webhook_secret_encrypted: "e2e",
        provider: "waha" as const,
        waha_session_name: `e2e-a1-${SUFIXO}`,
      })
      .select("id")
      .single();
    if (sessErr || !sessao) throw new Error(`sessão A1: ${sessErr?.message}`);

    const { data: contato, error: cErr } = await admin
      .from("contacts")
      .insert({
        organization_id: creds.org_id,
        display_name: `João Mendes ${SUFIXO}`,
        phone_number: `+551198${SUFIXO}`.slice(0, 15),
        tags: ["saas", "comercial"],
        papel: "lead",
      })
      .select("id")
      .single();
    if (cErr || !contato) throw new Error(`contato A1: ${cErr?.message}`);

    const { data: conversa, error: vErr } = await admin
      .from("conversations")
      .insert({
        organization_id: creds.org_id,
        contact_id: contato.id,
        channel_session_id: sessao.id,
        status: "open",
        last_message_preview: "Gostaria de saber o valor do plano.",
        last_message_at: new Date().toISOString(),
        last_inbound_at: new Date().toISOString(),
        tags: ["proposta"],
        unread_count_for_assignee: 2,
      })
      .select("id")
      .single();
    if (vErr || !conversa) throw new Error(`conversa A1: ${vErr?.message}`);
    conversaMinhaId = conversa.id;

    const { error: assignErr } = await admin.rpc("fn_conversation_assign", {
      p_organization_id: creds.org_id,
      p_conversation_id: conversa.id,
      p_to_user_id: creds.users.manager!.id,
      p_reason: "claim",
      p_expected_assignee: null,
      p_enforce_expected: false,
    });
    if (assignErr) throw new Error(`assign A1: ${assignErr.message}`);

    const { data: contatoFila, error: filaCErr } = await admin
      .from("contacts")
      .insert({
        organization_id: creds.org_id,
        display_name: `Fila A1 ${SUFIXO}`,
        phone_number: `+551199${SUFIXO}`.slice(0, 15),
        papel: "lead",
      })
      .select("id")
      .single();
    if (filaCErr || !contatoFila) throw new Error(`contato fila A1: ${filaCErr?.message}`);
    const { error: filaVErr } = await admin.from("conversations").insert({
      organization_id: creds.org_id,
      contact_id: contatoFila.id,
      channel_session_id: sessao.id,
      status: "open",
      last_message_preview: "Esperando na fila do comercial.",
      last_message_at: new Date().toISOString(),
      last_inbound_at: new Date().toISOString(),
    });
    if (filaVErr) throw new Error(`conversa fila A1: ${filaVErr.message}`);

    const { error: msgErr } = await admin.from("messages").insert([
      {
        organization_id: creds.org_id,
        conversation_id: conversa.id,
        channel_session_id: sessao.id,
        contact_id: contato.id,
        direction: "inbound",
        type: "text",
        body: "Gostaria de saber o valor do plano.",
        sent_via: "crm",
      },
      {
        organization_id: creds.org_id,
        conversation_id: conversa.id,
        channel_session_id: sessao.id,
        contact_id: contato.id,
        direction: "outbound",
        type: "text",
        body: "Claro — te envio a proposta ainda hoje.",
        sent_via: "user",
      },
    ]);
    if (msgErr) throw new Error(`messages A1: ${msgErr.message}`);
    const { error: noteErr } = await admin.from("conversation_notes").insert({
      organization_id: creds.org_id,
      conversation_id: conversa.id,
      body: "Cliente pediu proposta formal.",
      created_by_user_id: creds.users.manager!.id,
    });
    if (noteErr) throw new Error(`notes A1: ${noteErr.message}`);
  });

  test("inbox: lista, empty, conversa, dark e mobile", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await escolherTema(page, "light");
    await page.goto("/app/inbox");
    await expect(page.getByTestId("inbox-tab-mine")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Selecione uma conversa")).toBeVisible();
    await shot(SHOTS_INBOX, page, "07-inbox-empty-light.png");

    await page.goto(`/app/inbox/${conversaMinhaId}`);
    await expect(page.getByTestId("conversation-header")).toBeVisible({ timeout: 20_000 });
    await shot(SHOTS_INBOX, page, "02-inbox-conversation-light.png");
    await shot(SHOTS_INBOX, page, "03-inbox-crm-panel-light.png");
    await page.getByRole("button", { name: /nota interna/i }).click();
    await shot(SHOTS_INBOX, page, "04-inbox-note-light.png");

    await page.getByTestId("inbox-tab-all").click();
    await expect(page.locator("[data-conversation-id]").first()).toBeVisible({ timeout: 20_000 });
    await shot(SHOTS_INBOX, page, "01-inbox-list-light.png");

    await page.getByTestId("inbox-tab-unassigned").click();
    await shot(SHOTS_INBOX, page, "06-inbox-queue-light.png");

    await escolherTema(page, "dark");
    await page.goto("/app/inbox");
    await expect(page.getByTestId("inbox-tab-mine")).toBeVisible({ timeout: 20_000 });
    await shot(SHOTS_INBOX, page, "08-inbox-dark.png");

    await escolherTema(page, "light");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/inbox");
    await expect(page.getByTestId("inbox-tab-mine")).toBeVisible({ timeout: 20_000 });
    await shot(SHOTS_INBOX, page, "09-inbox-mobile-list.png");
    await page.goto(`/app/inbox/${conversaMinhaId}`);
    await expect(page.getByTestId("conversation-header")).toBeVisible({ timeout: 20_000 });
    await shot(SHOTS_INBOX, page, "10-inbox-mobile-thread.png");
    await page.getByRole("button", { name: /ficha/i }).click();
    await expect(page.getByRole("dialog", { name: /ficha do contato/i })).toBeVisible({
      timeout: 10_000,
    });
    await shot(SHOTS_INBOX, page, "11-inbox-mobile-ficha.png");
  });

  test("kanban: funis, board sem URI too long, dark e mobile", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await escolherTema(page, "light");
    await page.goto("/app/kanban");
    await expect(page.getByRole("heading", { name: "Funis" })).toBeVisible({ timeout: 20_000 });
    await shot(SHOTS_KANBAN, page, "01-funis-light.png");

    const abrir = page.locator('[data-testid^="abrir-"]').first();
    await expect(abrir).toBeVisible({ timeout: 15_000 });
    await abrir.click();
    await expect(page.getByText("URI too long")).toHaveCount(0);
    await expect(page.getByText("Não consegui carregar este funil")).toHaveCount(0);
    await expect(page.locator('[aria-label^="Lead:"]').first().or(page.getByText("vazio")).first()).toBeVisible({
      timeout: 30_000,
    });
    await shot(SHOTS_KANBAN, page, "02-board-light.png");
    await shot(SHOTS_KANBAN, page, "03-board-cards.png");
    await shot(SHOTS_KANBAN, page, "04-board-filters.png");
    if (await page.getByTestId("kanban-acao-atrasada").count()) {
      await shot(SHOTS_KANBAN, page, "05-card-overdue.png");
    }
    const card = page.locator('[aria-label^="Lead:"]').first();
    const box = await card.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 72, box.y + 36);
      await shot(SHOTS_KANBAN, page, "06-drag-state.png");
      await page.mouse.up();
    }

    await escolherTema(page, "dark");
    await shot(SHOTS_KANBAN, page, "07-board-dark.png");

    await escolherTema(page, "light");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/kanban");
    await expect(page.getByRole("heading", { name: "Funis" })).toBeVisible({ timeout: 20_000 });
    await shot(SHOTS_KANBAN, page, "08-funis-mobile.png");
    await page.locator('[data-testid^="abrir-"]').first().click();
    await expect(page.getByText("URI too long")).toHaveCount(0);
    await expect(page.getByText("Não consegui carregar este funil")).toHaveCount(0);
    await expect(page.locator('[aria-label^="Lead:"]').first().or(page.getByText("vazio")).first()).toBeVisible({
      timeout: 30_000,
    });
    await shot(SHOTS_KANBAN, page, "09-board-mobile.png");
  });
});
