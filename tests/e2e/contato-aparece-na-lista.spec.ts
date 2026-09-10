/**
 * Regressão do piloto: contato gravado e a lista parecia vazia.
 *
 * Causa: cadastro manual nascia sem last_activity_at e a lista ordena por
 * essa coluna (nulls last); o GET ainda devolvía [] se a org ativa falhasse
 * em silêncio. Este spec exercita o caminho do comercial: criar pela tela
 * com telefone brasileiro e ver a pessoa na lista, depois do refresh e na busca.
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
const sufixo = `${Date.now().toString(36)}`;
const NOME = `Maria Lista ${sufixo}`;
const FONE = `(48) 9${String(Date.now()).slice(-7)}`;

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(creds.users.manager!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

test("contato criado pela tela aparece na lista, no refresh e na busca", async ({ page }) => {
  await login(page);
  await page.goto("/app/contacts");
  await expect(page.getByRole("heading", { name: "Contatos" })).toBeVisible();

  await page.getByRole("button", { name: /novo contato/i }).click();
  await page.locator("#name").fill(NOME);
  await page.locator("#phone_number").fill(FONE);
  await page.getByRole("button", { name: /criar contato/i }).click();
  await expect(page.getByText(NOME)).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByText(NOME)).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder(/buscar por nome/i).fill(NOME);
  await expect(page.getByText(NOME)).toBeVisible({ timeout: 10_000 });

  await page.getByPlaceholder(/buscar por nome/i).fill(FONE);
  await expect(page.getByText(NOME)).toBeVisible({ timeout: 10_000 });
});
