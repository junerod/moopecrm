/**
 * Grade visual das capturas disponíveis. Não inventa tela.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs/visual-final/MOOPE_CRM_CONTACT_SHEET_FINAL.png");

const tiles: Array<{ label: string; src: string }> = [
  { label: "Home", src: "docs/visual-final/screenshots/desktop-light/01-home.png" },
  { label: "Inbox", src: "docs/visual-final/screenshots/desktop-light/02-inbox.png" },
  { label: "Inbox conversa", src: "docs/visual-final/screenshots/desktop-light/03-inbox-conversa.png" },
  { label: "Kanban", src: "docs/visual-final/screenshots/desktop-light/05-kanban.png" },
  { label: "Contatos", src: "docs/visual-final/screenshots/desktop-light/06-contatos.png" },
  { label: "Contato 360", src: "docs/visual-final/screenshots/desktop-light/07-contato-360.png" },
  { label: "Campanhas", src: "docs/visual-final/screenshots/desktop-light/10-campanhas.png" },
  { label: "Assistentes", src: "docs/visual-final/screenshots/desktop-light/13-assistentes.png" },
  { label: "Settings", src: "docs/visual-final/screenshots/desktop-light/19-settings.png" },
  { label: "Login", src: "docs/visual-final/screenshots/desktop-light/20-login.png" },
  { label: "360 dark", src: "docs/visual-final/screenshots/dark/04-contato-360.png" },
  { label: "Kanban dark", src: "docs/visual-final/screenshots/dark/03-kanban.png" },
  { label: "Contatos mobile", src: "docs/visual-final/screenshots/mobile/06-contatos.png" },
  { label: "Inbox mobile", src: "docs/visual-final/screenshots/mobile/02-inbox-lista.png" },
  { label: "360 mobile", src: "docs/visual-final/screenshots/mobile/07-contato-360.png" },
];

async function main() {
  const cells = tiles
    .filter((t) => fs.existsSync(path.join(ROOT, t.src)))
    .map((t) => {
      const abs = path.join(ROOT, t.src);
      const b64 = fs.readFileSync(abs).toString("base64");
      return `<figure><img src="data:image/png;base64,${b64}" alt="${t.label}" /><figcaption>${t.label}</figcaption></figure>`;
    });
  const html = `<!doctype html><html><head><style>
    body{margin:16px;background:#0B1F3A;font-family:ui-sans-serif,system-ui;color:#E8EEF6}
    h1{font-size:18px;margin:0 0 12px}
    .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    figure{margin:0;background:#121A2B;border-radius:8px;overflow:hidden}
    img{width:100%;height:180px;object-fit:cover;object-position:top;display:block}
    figcaption{font-size:11px;padding:6px 8px}
  </style></head><body>
  <h1>MOOPE CRM — contact sheet final</h1>
  <div class="grid">${cells.join("")}</div>
  </body></html>`;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  console.log("sheet", OUT);
}

main();
