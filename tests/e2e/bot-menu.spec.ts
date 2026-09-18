/**
 * Bot visual — menu 1/2 no quadro de Automações.
 * Cria pela tela, publica, simula inbound (mesmo helper da jornada de follow-up).
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect, type Page } from "@playwright/test";

import { afirmarAdminDeTenantPuro } from "./utils/precondicao";
import { generateTotp, msUntilNextTotpWindow } from "./utils/totp";
import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");

interface Creds {
  org_id: string;
  password: string;
  users: Record<string, { email: string }>;
  admin_totp?: { factor_id: string; secret: string };
}

function loadCreds(): Creds {
  if (!fs.existsSync(CREDS_PATH)) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
  }
  return JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
}

function loadInternalSecret(): string {
  const secret = carregarEnvLocal().INTERNAL_SECRET?.trim();
  if (!secret) throw new Error("INTERNAL_SECRET não encontrado em .env.local");
  return secret;
}

let creds = loadCreds();

test.beforeAll(async () => {
  await afirmarAdminDeTenantPuro(creds.users.admin!.email);
});

function runHelper(args: string[]): unknown {
  const stdout = execFileSync("npx", ["tsx", "scripts/e2e-followup-journey-helpers.ts", ...args], {
    encoding: "utf8",
  });
  const lastLine = stdout.trim().split("\n").filter(Boolean).pop();
  if (!lastLine) throw new Error(`helper ${args[0]} sem JSON`);
  return JSON.parse(lastLine);
}

async function loginWithTotp(page: Page, email: string, secretTotp: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/login\/mfa/);
  for (let attempt = 0; attempt < 2; attempt++) {
    if (msUntilNextTotpWindow() < 3_000) {
      await page.waitForTimeout(msUntilNextTotpWindow() + 200);
    }
    const code = generateTotp(secretTotp);
    await page.locator('input[aria-label="Dígito 1"]').click();
    await page.keyboard.type(code, { delay: 40 });
    try {
      await page.waitForURL(/\/app\//, { timeout: 8_000 });
      return;
    } catch {
      await page.waitForTimeout(msUntilNextTotpWindow() + 200);
    }
  }
  throw new Error("MFA falhou");
}

const MENU_GRAPH = {
  nodes: [
    { id: "t1", type: "trigger", label: "Início", position: { x: 0, y: 80 }, config: {} },
    {
      id: "m1",
      type: "menu",
      label: "Menu",
      position: { x: 280, y: 80 },
      config: {
        title: "Como posso ajudar?",
        options: [
          { id: "opt_1", number: 1, label: "Atendimento", keywords: [] },
          { id: "opt_2", number: 2, label: "Comercial", keywords: [] },
        ],
      },
    },
    { id: "e1", type: "end", label: "Fim 1", position: { x: 560, y: 0 }, config: { outcome: "exhausted" } },
    { id: "e2", type: "end", label: "Fim 2", position: { x: 560, y: 160 }, config: { outcome: "exhausted" } },
    { id: "e3", type: "end", label: "Fim else", position: { x: 560, y: 320 }, config: { outcome: "exhausted" } },
  ],
  edges: [
    { id: "edge-t", source: "t1", target: "m1", priority: 0, condition: { type: "always" } },
    { id: "edge-opt1", source: "m1", target: "e1", priority: 0, condition: { type: "branch", branch_id: "opt_1" } },
    { id: "edge-opt2", source: "m1", target: "e2", priority: 0, condition: { type: "branch", branch_id: "opt_2" } },
    { id: "edge-else", source: "m1", target: "e3", priority: 0, condition: { type: "always" } },
  ],
};

test.describe("bot visual — menu 1/2", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("cria menu na tela, publica, inbound 1 segue o ramo", async ({ page }) => {
    test.setTimeout(180_000);
    const totp = creds.admin_totp?.secret;
    if (!totp || !creds.users.admin) throw new Error("admin + totp no .e2e-creds");
    await loginWithTotp(page, creds.users.admin.email, totp);

    await page.goto("/app/ai/followups");
    await page.getByRole("tab", { name: "Bots" }).click();
    await page.getByRole("button", { name: "Novo bot" }).click();
    const nome = `Bot menu ${Date.now()}`;
    await page.getByLabel("Nome").fill(nome);
    await page.getByRole("button", { name: "Criar bot" }).click();
    await expect(page.getByText(nome)).toBeVisible({ timeout: 15_000 });
    await page.locator("li", { hasText: nome }).getByRole("link").click();
    await expect(page.getByTestId("node-palette")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("palette-add-menu")).toBeVisible();
    await expect(page.getByTestId("palette-add-horario")).toBeVisible();
    await page.getByTestId("palette-add-menu").click();

    const flowId = page.url().split("/followups/")[1]?.split(/[?#]/)[0];
    if (!flowId) throw new Error("sem id do fluxo na URL");

    const patch = await page.request.patch(`/api/v1/ai/followup-flows/${flowId}`, {
      data: { draft_graph: MENU_GRAPH, trigger_config: { kind: "inbound" } },
    });
    expect(patch.ok(), await patch.text()).toBeTruthy();

    const pub = await page.request.post(`/api/v1/ai/followup-flows/${flowId}/publish`, { data: {} });
    expect(pub.ok(), await pub.text()).toBeTruthy();

    execFileSync("npx", ["tsx", "scripts/seed-e2e-followup-agent.ts"], { stdio: "inherit" });
    creds = loadCreds();
    runHelper(["prepare-agent-fixtures"]);
    const seed = runHelper(["seed-silent-contact"]) as {
      contactId: string;
      conversationId: string;
      channelSessionId: string;
    };

    runHelper([
      "simulate-inbound",
      creds.org_id,
      seed.conversationId,
      seed.contactId,
      seed.channelSessionId,
      "oi",
    ]);

    const secret = loadInternalSecret();
    for (let i = 0; i < 6; i++) {
      await page.request.post("/api/v1/cron/event-log-drain", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      await page.request.post("/api/v1/cron/followup-flow-worker", {
        headers: { Authorization: `Bearer ${secret}` },
      });
    }

    const job = runHelper(["find-job", seed.contactId, "send_message"]) as {
      payload?: { fixed_body?: string; node_id?: string };
    } | null;
    expect(job?.payload?.fixed_body, "menu tem de sair com 1 e 2").toMatch(/1 Atendimento/);
    expect(job?.payload?.fixed_body).toMatch(/2 Comercial/);

    const enrollment = runHelper(["find-enrollment", creds.org_id, flowId, seed.contactId]) as {
      id: string;
      current_node_id: string;
    };
    expect(enrollment?.id, "enrollment do bot depois do oi").toBeTruthy();
    expect(enrollment.current_node_id).toBe("m1");
    runHelper(["complete-turn", creds.org_id, enrollment.id, "m1", JSON.stringify({ kind: "sent" })]);

    runHelper([
      "simulate-inbound",
      creds.org_id,
      seed.conversationId,
      seed.contactId,
      seed.channelSessionId,
      "1",
    ]);
    for (let i = 0; i < 6; i++) {
      await page.request.post("/api/v1/cron/event-log-drain", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      await page.request.post("/api/v1/cron/followup-flow-worker", {
        headers: { Authorization: `Bearer ${secret}` },
      });
    }

    const after = runHelper(["find-enrollment", creds.org_id, flowId, seed.contactId]) as {
      current_node_id: string;
      status: string;
    };
    expect(after.current_node_id).toBe("e1");

    runHelper(["cleanup-flow-enrollments", flowId]);
    runHelper(["cleanup-contact", seed.contactId]);
  });
});
