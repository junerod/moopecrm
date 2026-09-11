/**
 * AFTER do UX Refresh 1. Só lê e tira PNG. Sem WAHA, sem QR, sem envio.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const APP = process.env.UX_REFRESH_URL ?? "http://127.0.0.1:3012";
const OUT = path.join(process.cwd(), "docs/ux-refresh-1/screenshots");
const creds = JSON.parse(fs.readFileSync(".e2e-creds.json", "utf8")) as {
  password: string;
  users: Record<string, { email: string }>;
};

async function shot(page: Page, rel: string) {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("png", rel);
}

async function login(page: Page) {
  await page.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(creds.users.manager!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

async function gotoQuiet(page: Page, href: string) {
  await page.goto(`${APP}${href}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(900);
}

async function esperarLista(page: Page) {
  await page.getByRole("tab", { name: /Minhas|Fila/i }).first().waitFor({ timeout: 20_000 }).catch(() => undefined);
  await page.waitForTimeout(700);
}

async function abrirPessoa(page: Page) {
  await esperarLista(page);
  const humana = page.getByText(/Marina Souza|Carlos Mendes|Auto Locação/i).first();
  if (await humana.count()) {
    await humana.click();
    await page.waitForTimeout(1200);
    return;
  }
  const fila = page.getByRole("tab", { name: /^Fila/i });
  if (await fila.count()) {
    await fila.click();
    await page.waitForTimeout(900);
  }
  const row = page.locator("button[data-conversation-id]").first();
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(1200);
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await desktop.newPage();
  await login(d);
  await gotoQuiet(d, "/app/inicio");
  await shot(d, "inicio-desktop-1440.png");
  await shot(d, "sidebar-desktop-1440.png");
  await gotoQuiet(d, "/app/inbox");
  await esperarLista(d);
  await shot(d, "inbox-lista-desktop-1440.png");
  await abrirPessoa(d);
  await shot(d, "inbox-conversa-desktop-1440.png");
  await shot(d, "cockpit-desktop-1440.png");
  await shot(d, "header-desktop-1440.png");
  await desktop.close();

  const note = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const n = await note.newPage();
  await login(n);
  await gotoQuiet(n, "/app/inicio");
  await shot(n, "inicio-notebook-1280.png");
  await gotoQuiet(n, "/app/inbox");
  await esperarLista(n);
  await abrirPessoa(n);
  await shot(n, "inbox-notebook-1280.png");
  await note.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await mobile.newPage();
  await login(m);
  await gotoQuiet(m, "/app/inicio");
  await shot(m, "inicio-mobile.png");
  await gotoQuiet(m, "/app/inbox");
  await esperarLista(m);
  await shot(m, "inbox-lista-mobile.png");
  await abrirPessoa(m);
  await shot(m, "inbox-conversa-mobile.png");
  const ficha = m.getByRole("button", { name: /ficha/i });
  if (await ficha.count()) {
    await ficha.click();
    await m.waitForTimeout(800);
    await shot(m, "ficha-mobile.png");
  }
  await mobile.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
