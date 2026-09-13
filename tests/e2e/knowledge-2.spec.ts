/**
 * Knowledge 2.0 — upload de PDF fecha o RAG existente.
 * Sem WhatsApp real. Sem segundo vector DB.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { montarPdfTextual } from "@/lib/ai/rag/pdf-textual";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "WizardQa!2026#Deskcomm";
const SHOTS = path.join(process.cwd(), "docs/knowledge-2/screenshots");

type Conta = { email: string; userId: string; orgId: string };

async function criarConta(prefixo: string, nome: string): Promise<Conta> {
  const email = `${prefixo}-${randomUUID().slice(0, 8)}@qa.local`;
  const { data: criado, error: errUser } = await svc.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (errUser || !criado.user) throw errUser ?? new Error("sem usuário");
  const { data: org, error: errOrg } = await svc
    .from("organizations")
    .insert({
      slug: `${prefixo}-${randomUUID().slice(0, 8)}`,
      display_name: nome,
      legal_name: nome,
      status: "active",
      created_by: criado.user.id,
      onboarded_at: new Date().toISOString(),
      settings: { llm: { provider: "anthropic" } },
    })
    .select("id")
    .single();
  if (errOrg || !org) throw errOrg ?? new Error("sem org");
  await svc.from("user_organizations").insert({
    organization_id: org.id,
    user_id: criado.user.id,
    role: "admin",
    accepted_at: new Date().toISOString(),
  });
  return { email, userId: criado.user.id, orgId: org.id as string };
}

async function apagar(conta: Conta | null): Promise<void> {
  if (!conta) return;
  await svc.from("ai_chunks").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_faq_items").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_knowledge_sources").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_knowledge_versions").delete().eq("organization_id", conta.orgId);
  await svc.from("ai_agents").delete().eq("organization_id", conta.orgId);
  await svc.from("user_organizations").delete().eq("organization_id", conta.orgId);
  await svc.from("organizations").delete().eq("id", conta.orgId);
  await svc.auth.admin.deleteUser(conta.userId);
}

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

function pdfDoGerador(): string {
  const dest = path.join(os.tmpdir(), "Gerador-Industrial-MOOPE.pdf");
  writeFileSync(
    dest,
    montarPdfTextual([
      "AZUL-9271 Gerador Industrial MOOPE TESTE KB Diaria R$ 347,80",
    ]),
  );
  return dest;
}

async function shot(page: Page, nome: string): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, nome), fullPage: true });
}

test.describe("Knowledge 2.0", () => {
  test.setTimeout(180_000);
  let orgA: Conta | null = null;
  let orgB: Conta | null = null;

  test.afterAll(async () => {
    await apagar(orgA);
    await apagar(orgB);
  });

  test("upload → pergunta → citação → exclusão → isolamento + mobile/dark", async ({
    page,
  }) => {
    orgA = await criarConta("kb2a", "Org A Knowledge");
    orgB = await criarConta("kb2b", "Org B Knowledge");

    await login(page, orgA.email);
    await page.goto("/app/ai/knowledge/sources");
    await expect(page.getByRole("heading", { name: "Conhecimento da Empresa" })).toBeVisible();
    await expect(page.getByTestId("aba-conhecimento-documentos")).toBeVisible();
    await shot(page, "01-documentos-empty.png");

    const upload = page.waitForResponse(
      (r) => r.url().includes("/api/v1/ai/knowledge/sources/upload") && r.request().method() === "POST",
    );
    await page.getByTestId("conhecimento-upload-input").setInputFiles(pdfDoGerador());
    await shot(page, "02-upload.png");
    const upRes = await upload;
    const upBody = await upRes.text();
    expect(upRes.ok(), `upload PDF precisa ser 2xx (foi ${upRes.status()} ${upBody})`).toBeTruthy();
    await expect(page.getByText(/documento enviado/i)).toBeVisible({ timeout: 15_000 });
    await shot(page, "03-processando.png");
    await expect(page.getByTestId("conhecimento-lista-documentos")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("[data-testid='conhecimento-lista-documentos'] li").first()).toBeVisible();
    await shot(page, "04-pronto.png");

    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual a diaria do Gerador Industrial MOOPE TESTE KB?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    const achou = page.getByTestId("testar-conhecimento-resposta");
    await expect(achou).toBeVisible({ timeout: 20_000 });
    await expect(achou).toContainText(/347,80/);
    await shot(page, "05-testar-resposta.png");
    await expect(page.getByTestId("testar-conhecimento-fontes")).toBeVisible();
    await expect(page.getByTestId("testar-conhecimento-fontes")).toContainText(/Gerador|MOOPE|\.pdf/i);
    await shot(page, "06-citacao.png");

    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual o codigo da regra exclusiva?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-resposta")).toContainText(/AZUL-9271/);

    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual é a taxa de entrega para Blumenau?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-vazio")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("aba-conhecimento-documentos").click();
    await page.getByRole("button", { name: "Ações do documento" }).first().click();
    await page.getByRole("button", { name: "Reprocessar" }).click();
    await expect(page.getByText(/reindex|segundo plano|indexando/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Ações do documento" }).first().click();
    await page.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText(/removido|Nenhum documento/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual a diaria do Gerador Industrial MOOPE TESTE KB?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-vazio")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("aba-conhecimento-texto").click();
    await expect(page.getByTestId("adicionar-conhecimento")).toBeVisible();
    await shot(page, "07-texto-rapido.png");
    await page.getByTestId("conhecimento-texto").fill(
      "Locacao de gerador. Caução 500. Pagamento no pix.",
    );
    await page.getByTestId("conhecimento-organizar").click();
    const preview = page.getByTestId("conhecimento-organizar-preview");
    const erroOrg = page.getByText(/não está disponível|Não consegui organizar/i);
    await expect(preview.or(erroOrg).first()).toBeVisible({ timeout: 30_000 });
    if (await preview.isVisible()) {
      await expect(page.getByText("Original")).toBeVisible();
      await expect(page.getByText("Versão organizada")).toBeVisible();
      await shot(page, "08-organizar-ia.png");
      await page.getByRole("button", { name: "Manter original" }).click();
      await expect(preview).toHaveCount(0);
    } else {
      await shot(page, "08-organizar-ia.png");
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("aba-conhecimento-documentos").click();
    await expect(page.getByTestId("conhecimento-dropzone")).toBeVisible();
    await shot(page, "09-mobile.png");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 390 + 2);
    expect(overflow, "sem scroll horizontal em 390").toBeFalsy();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByTestId("theme-control").click();
    await page.getByTestId("theme-option-dark").click();
    await shot(page, "10-dark.png");

    await page.getByTestId("theme-control").click();
    await page.getByTestId("theme-option-light").click();

    await login(page, orgB.email);
    await page.goto("/app/ai/knowledge/sources");
    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual a diaria do Gerador Industrial MOOPE TESTE KB?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-vazio")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("body")).not.toContainText("AZUL-9271");
    await expect(page.locator("body")).not.toContainText("347,80");
  });
});
