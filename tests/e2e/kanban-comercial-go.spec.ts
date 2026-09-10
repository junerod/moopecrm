/**
 * Fluxo comercial mínimo no Kanban: funil, lead com origem, perder, reabrir.
 * Impede regressão das lacunas que o GO fechou. Limpa o funil no final.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect, type Page } from "@playwright/test";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");

interface Creds {
  password: string;
  users: Record<string, { email: string }>;
}

function lerCreds(): Creds {
  if (!fs.existsSync(CREDS_PATH)) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
  }
  let c = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
  if (!c.users?.manager) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
    c = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
  }
  return c;
}

const creds = lerCreds();
const SUFIXO = Date.now().toString(36);
const FUNIL = `Comercial GO ${SUFIXO}`;
const LEAD = `Ana Costa — Clínica ${SUFIXO}`;

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(creds.users.manager!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

function linhaDoFunil(page: Page, nome: string) {
  return page.locator('li[data-testid^="funil-"]').filter({ hasText: nome });
}

async function menuDoCard(page: Page, titulo: string) {
  await page.getByRole("group", { name: `Lead: ${titulo}` }).getByRole("button", { name: /ações do lead/i }).click();
}

test("comercial cria lead, perde com motivo e reabre", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);
  await page.goto("/app/kanban");
  await expect(page.getByRole("heading", { name: "Funis" })).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("novo-funil").click();
  await page.getByTestId("nome-do-novo-funil").fill(FUNIL);
  await page.getByTestId("confirmar-novo-funil").click();
  await expect(linhaDoFunil(page, FUNIL)).toBeVisible({ timeout: 15_000 });

  await linhaDoFunil(page, FUNIL).getByRole("link").click();
  await page.waitForURL(/\/app\/pipelines\//);
  await expect(page.getByRole("button", { name: /novo lead/i })).toBeVisible({ timeout: 20_000 });

  await page.getByRole("button", { name: /novo lead/i }).click();
  await page.locator("#title").fill(LEAD);
  await page.locator("#contact_name").fill("Ana Costa");
  await page.locator("#contact_phone").fill("(48) 99991-0001");
  await page.getByRole("button", { name: /criar lead/i }).click();
  await expect(page.getByText("Lead criado")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(LEAD)).toBeVisible({ timeout: 15_000 });

  await menuDoCard(page, LEAD);
  await page.getByRole("menuitem", { name: /marcar como perdido/i }).click();
  await expect(page.getByRole("radio", { name: "Escolheu concorrente" })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Preço" })).toBeVisible();
  await page.keyboard.press("Escape");

  const pipelineId = page.url().split("/").pop()!;
  const boardRes = await page.request.get(`/api/v1/pipelines/${pipelineId}/board`);
  expect(boardRes.ok()).toBeTruthy();
  const board = (await boardRes.json()) as {
    data: { leads: Array<{ id: string; title: string; stage_id: string; status: string }>; stages: Array<{ id: string; is_won: boolean; is_lost: boolean }> };
  };
  const lead = board.data.leads.find((l) => l.title === LEAD);
  expect(lead, "lead criado precisa estar no quadro").toBeTruthy();
  const lose = await page.request.post(`/api/v1/leads/${lead!.id}/lose`, {
    data: { lost_reason: "price" },
  });
  expect(lose.ok(), `perder: ${lose.status()} ${await lose.text()}`).toBeTruthy();

  await page.reload();
  const aberta = board.data.stages.find((s) => !s.is_won && !s.is_lost);
  expect(aberta).toBeTruthy();
  await menuDoCard(page, LEAD);
  await page.getByRole("menuitem", { name: /reabrir/i }).click();
  await expect(page.getByText(LEAD)).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByText(LEAD)).toBeVisible({ timeout: 15_000 });

  await page.goto("/app/kanban");
  const testid = await linhaDoFunil(page, FUNIL).getAttribute("data-testid");
  const id = testid?.replace(/^funil-/, "") ?? "";
  if (id) {
    const arq = await page.request.delete(`/api/v1/pipelines/${id}`);
    expect(arq.ok(), `arquivar funil de teste: ${arq.status()} ${await arq.text()}`).toBeTruthy();
    await page.reload();
    await expect(linhaDoFunil(page, FUNIL)).toHaveCount(0);
  }
});
