/**
 * Captura da certificação visual. Só lê e tira PNG.
 * Não toca WhatsApp, QR, sessão WORKING.
 *
 * VISUAL_URL (default http://127.0.0.1:3666)
 * VISUAL_EMAIL / VISUAL_PASSWORD — se ausentes, tenta .e2e-creds.json
 * Sem login: só a fachada /login.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium, type Page } from "@playwright/test";

const APP = process.env.VISUAL_URL ?? "http://127.0.0.1:3666";
const ROOT = path.join(process.cwd(), "docs/visual-final/screenshots");

function creds(): { email: string; password: string } | null {
  if (process.env.VISUAL_EMAIL && process.env.VISUAL_PASSWORD) {
    return { email: process.env.VISUAL_EMAIL, password: process.env.VISUAL_PASSWORD };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(".e2e-creds.json", "utf8")) as {
      password: string;
      users: Record<string, { email: string }>;
    };
    const email = raw.users.manager?.email ?? raw.users.admin?.email;
    if (email && raw.password) return { email, password: raw.password };
  } catch {
    /* sem seed e2e */
  }
  return null;
}

async function shot(page: Page, rel: string) {
  const dest = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: dest, fullPage: false });
  console.log("png", rel);
}

async function login(page: Page, c: { email: string; password: string }) {
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(c.email);
  await page.locator("#password").fill(c.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 45_000 });
}

async function go(page: Page, href: string) {
  await page.goto(`${APP}${href}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(800);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const c = creds();

  const light = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await light.newPage();
  await p.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await shot(p, "desktop-light/20-login.png");

  if (!c) {
    console.log("sem credenciais — só login");
    await light.close();
    await browser.close();
    return;
  }

  try {
    await login(p, c);
  } catch (err) {
    console.log("login falhou — só login capturado", String(err).slice(0, 200));
    await light.close();
    await browser.close();
    return;
  }

  const desktop: Array<[string, string]> = [
    ["/app/inicio", "desktop-light/01-home.png"],
    ["/app/inbox", "desktop-light/02-inbox.png"],
    ["/app/kanban", "desktop-light/04-funis.png"],
    ["/app/contacts", "desktop-light/06-contatos.png"],
    ["/app/agenda", "desktop-light/08-agenda.png"],
    ["/app/radar", "desktop-light/09-radar.png"],
    ["/app/campanhas", "desktop-light/10-campanhas.png"],
    ["/app/ai", "desktop-light/12-ia-hub.png"],
    ["/app/ai/agents", "desktop-light/13-assistentes.png"],
    ["/app/ai/followups", "desktop-light/14-automacoes.png"],
    ["/app/ai/knowledge/sources", "desktop-light/15-conhecimento.png"],
    ["/app/connections", "desktop-light/16-conexoes.png"],
    ["/app/metrics", "desktop-light/17-desempenho.png"],
    ["/app/team", "desktop-light/18-equipe.png"],
    ["/app/settings", "desktop-light/19-settings.png"],
    ["/app/settings/business", "desktop-light/19b-meu-negocio.png"],
  ];
  for (const [href, file] of desktop) {
    await go(p, href);
    await shot(p, file);
  }

  await go(p, "/app/inbox");
  const row = p.locator("button[data-conversation-id]").first();
  if (await row.count()) {
    await row.click();
    await p.waitForTimeout(1000);
    await shot(p, "desktop-light/03-inbox-conversa.png");
  }
  const card = p.locator("a[href^='/app/pipelines/']").first();
  await go(p, "/app/kanban");
  const abrir = p.locator("[data-testid^='abrir-']").first();
  if (await abrir.count()) {
    await abrir.click();
    await p.waitForTimeout(1200);
    await shot(p, "desktop-light/05-kanban.png");
  } else if (await card.count()) {
    await card.click();
    await p.waitForTimeout(1200);
    await shot(p, "desktop-light/05-kanban.png");
  }
  await go(p, "/app/contacts");
  const contato = p.locator("a[href^='/app/contacts/']").first();
  if (await contato.count()) {
    await contato.click();
    await p.waitForTimeout(1000);
    await shot(p, "desktop-light/07-contato-360.png");
  }
  await go(p, "/app/campanhas");
  const camp = p.locator("a[href^='/app/campanhas/']").first();
  if (await camp.count()) {
    await camp.click();
    await p.waitForTimeout(800);
    await shot(p, "desktop-light/11-campanha-detalhe.png");
  }

  await p.evaluate(() => localStorage.setItem("deskcomm-theme", "dark"));
  await go(p, "/app/inicio");
  await shot(p, "dark/01-home.png");
  await go(p, "/app/inbox");
  if (await row.count()) {
    await row.click();
    await p.waitForTimeout(800);
  }
  await shot(p, "dark/02-inbox-conversa.png");
  await go(p, "/app/kanban");
  const abrirDark = p.locator("[data-testid^='abrir-']").first();
  if (await abrirDark.count()) {
    await abrirDark.click();
    await p.waitForTimeout(1200);
    await shot(p, "dark/03-kanban.png");
  }
  await go(p, "/app/contacts");
  if (await contato.count()) {
    await contato.click();
    await p.waitForTimeout(800);
    await shot(p, "dark/04-contato-360.png");
  }
  await go(p, "/app/campanhas");
  await shot(p, "dark/05-campanhas.png");
  await go(p, "/app/ai/agents");
  await shot(p, "dark/06-assistentes.png");
  await go(p, "/app/settings");
  await shot(p, "dark/07-settings.png");
  await light.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const m = await mobile.newPage();
  await login(m, c);
  const mobilePages: Array<[string, string]> = [
    ["/app/inicio", "mobile/01-home.png"],
    ["/app/inbox", "mobile/02-inbox-lista.png"],
    ["/app/contacts", "mobile/06-contatos.png"],
    ["/app/agenda", "mobile/08-agenda.png"],
    ["/app/campanhas", "mobile/09-campanhas.png"],
    ["/app/ai/agents", "mobile/10-assistentes.png"],
    ["/app/ai/followups", "mobile/11-automacoes.png"],
    ["/app/ai/knowledge/sources", "mobile/12-conhecimento.png"],
    ["/app/settings", "mobile/13-settings.png"],
  ];
  for (const [href, file] of mobilePages) {
    await go(m, href);
    await shot(m, file);
  }

  await go(m, "/app/inbox");
  const mRow = m.locator("button[data-conversation-id]").first();
  if (await mRow.count()) {
    await mRow.click();
    await m.waitForTimeout(1000);
    await shot(m, "mobile/03-inbox-conversa.png");
    const ficha = m.getByRole("button", { name: /ficha/i });
    if (await ficha.count()) {
      await ficha.click();
      await m.waitForTimeout(600);
      await shot(m, "mobile/04-inbox-ficha.png");
      await m.keyboard.press("Escape");
    }
  }
  await go(m, "/app/kanban");
  const mAbrir = m.locator("[data-testid^='abrir-']").first();
  if (await mAbrir.count()) {
    await mAbrir.click();
    await m.waitForTimeout(1200);
    await shot(m, "mobile/05-kanban.png");
  }
  await go(m, "/app/contacts");
  const mContato = m.locator("a[href^='/app/contacts/']").first();
  if (await mContato.count()) {
    await mContato.click();
    await m.waitForTimeout(1000);
    await shot(m, "mobile/07-contato-360.png");
  }

  await mobile.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
