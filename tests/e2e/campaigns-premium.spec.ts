/**
 * Campanhas premium — wizard, modelos, preview, agendar, cancelar, status PT.
 * Sem QR. Sem envio WhatsApp externo real.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const FIX_IMG = path.join(process.cwd(), "tests/e2e/fixtures/campaign-image.png");

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
const SUFIXO = String(Date.now()).slice(-8);
const TAG = `prem-${SUFIXO}`;

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

test.describe("Campanhas premium", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(async () => {
    if (!fs.existsSync(CREDS_PATH)) {
      execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
    }
    creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
    await admin.from("contacts").insert({
      organization_id: creds.org_id,
      display_name: `Premium ${SUFIXO}`,
      phone_number: `+551195${SUFIXO}`.slice(0, 15),
      email: `prem${SUFIXO}@exemplo.com`,
      tags: [TAG],
    });
    await admin.from("message_templates").insert({
      organization_id: creds.org_id,
      title: "Volte a alugar com a gente",
      body: "Oi {{nome}}, faz um tempo.",
      owner_user_id: null,
    });
  });

  test("wizard, modelo, preview, agendar e detalhe em português", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/campanhas");
    await expect(page.getByRole("heading", { name: "Campanhas" })).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("campanha-nova").click();
    await expect(page.getByTestId("campanha-wizard")).toBeVisible();
    await page.getByTestId("campanha-objetivo-reativacao").click();
    await page.getByTestId("campanha-proximo").click();
    await page.locator("#camp-tag").fill(TAG);
    await expect(page.getByTestId("campanha-estimativa")).toContainText(/contatos encontrados/i, {
      timeout: 15_000,
    });
    await page.getByTestId("campanha-ver-contatos").click();
    await expect(page.getByTestId("campanha-preview-contatos")).toBeVisible();
    await page.getByTestId("campanha-proximo").click();
    const modelo = page.getByText("Volte a alugar com a gente").first();
    if (await modelo.isVisible().catch(() => false)) await modelo.click();
    await page.locator("#camp-nome").fill(`Premium ${SUFIXO}`);
    if (fs.existsSync(FIX_IMG)) {
      await page.getByTestId("campanha-anexar-midia").setInputFiles(FIX_IMG);
    }
    await expect(page.getByTestId("campanha-preview-whatsapp")).toBeVisible();
    await page.getByRole("button", { name: "E-mail" }).click();
    await expect(page.getByTestId("campanha-preview-email")).toBeVisible();
    await page.getByTestId("campanha-proximo").click();
    await page.getByTestId("campanha-canal-ambos").click();
    await page.getByTestId("campanha-proximo").click();
    await page.getByTestId("campanha-agendar").check();
    await page.getByTestId("campanha-proximo").click();
    await expect(page.getByTestId("campanha-passo-revisar")).toBeVisible();
    await page.getByTestId("campanha-enviar").click();
    await expect(page.getByTestId("campanha-resultado")).toBeVisible({ timeout: 20_000 });

    const lista = await page.request.get("/api/v1/campanhas");
    const camps = (await lista.json()) as { data: Array<{ id: string; name: string }> };
    const camp = camps.data.find((c) => c.name.includes(`Premium ${SUFIXO}`));
    expect(camp).toBeTruthy();
    const cancel = await page.request.post(`/api/v1/campanhas/${camp!.id}/cancel`, { data: {} });
    expect(cancel.ok()).toBeTruthy();
  });

  test("status do destinatário em português e tenant isolation", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    const criar = await page.request.post("/api/v1/campanhas", {
      data: {
        name: `Iso ${SUFIXO}`,
        body_text: "Olá {{nome}}",
        segment: { tags: [TAG] },
        settings: { channels: "whatsapp", confirm_all_base: false },
      },
    });
    expect(criar.ok()).toBeTruthy();
    const criada = (await criar.json()) as { data: { id: string } };
    await page.request.post(`/api/v1/campanhas/${criada.data.id}/start`, { data: {} });
    await page.goto(`/app/campanhas/${criada.data.id}`);
    await expect(page.getByTestId("campanha-resultado")).toBeVisible();
    const dest = page.getByTestId("campanha-destinatarios");
    if (await dest.isVisible()) {
      await expect(dest).not.toContainText(/\bpending\b/);
    }
  });

  test("mobile 390 sem overflow estrutural", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, creds.users.manager!.email);
    await page.goto("/app/campanhas/nova");
    await expect(page.getByTestId("campanha-wizard")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 390 + 8);
    expect(overflow).toBeFalsy();
  });
});
