/**
 * Knowledge — documentos reais (não gerados por montarPdfTextual).
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "WizardQa!2026#Deskcomm";
const FIX = join(process.cwd(), "tests/fixtures/knowledge");

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

test.describe("Knowledge documentos reais", () => {
  test.setTimeout(180_000);
  let orgA: Conta | null = null;
  let orgB: Conta | null = null;

  test.afterAll(async () => {
    await apagar(orgA);
    await apagar(orgB);
  });

  test("PDF real + DOCX + TXT + MD + OCR necessário + isolamento", async ({ page }) => {
    orgA = await criarConta("kbrA", "Org A Docs Reais");
    orgB = await criarConta("kbrB", "Org B Docs Reais");

    await login(page, orgA.email);
    await page.goto("/app/ai/knowledge/sources");
    await expect(page.getByTestId("aba-conhecimento-documentos")).toBeVisible();

    const upPdf = page.waitForResponse(
      (r) => r.url().includes("/sources/upload") && r.request().method() === "POST",
    );
    await page.getByTestId("conhecimento-upload-input").setInputFiles(join(FIX, "pdf-real-plataforma.pdf"));
    const pdfRes = await upPdf;
    expect(pdfRes.ok(), `PDF real ${pdfRes.status()}`).toBeTruthy();
    const pdfBody = (await pdfRes.json()) as { data?: { extract_status?: string } };
    expect(pdfBody.data?.extract_status).toBe("ready");

    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual o preco da Plataforma Elevatoria TESTE PDF REAL?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    const resp = page.getByTestId("testar-conhecimento-resposta");
    await expect(resp).toBeVisible({ timeout: 20_000 });
    await expect(resp).toContainText(/742,30/);
    await expect(page.getByTestId("testar-conhecimento-fontes")).toContainText(/pdf-real-plataforma|\.pdf/i);

    await page.getByTestId("aba-conhecimento-documentos").click();
    const upDocx = page.waitForResponse(
      (r) => r.url().includes("/sources/upload") && r.request().method() === "POST",
    );
    await page.getByTestId("conhecimento-upload-input").setInputFiles(join(FIX, "docx-compressor.docx"));
    expect((await upDocx).ok()).toBeTruthy();

    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual o preço do Compressor Atlas TESTE DOCX?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-resposta")).toContainText(/918,40/, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("testar-conhecimento-fontes")).toContainText(/docx/i);

    await page.getByTestId("aba-conhecimento-documentos").click();
    const upTxt = page.waitForResponse(
      (r) => r.url().includes("/sources/upload") && r.request().method() === "POST",
    );
    await page.getByTestId("conhecimento-upload-input").setInputFiles(join(FIX, "regras.txt"));
    expect((await upTxt).ok()).toBeTruthy();
    const upMd = page.waitForResponse(
      (r) => r.url().includes("/sources/upload") && r.request().method() === "POST",
    );
    await page.getByTestId("conhecimento-upload-input").setInputFiles(join(FIX, "garantias.md"));
    expect((await upMd).ok()).toBeTruthy();

    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill("Qual o codigo TXT-4401?");
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-resposta")).toContainText(/TXT-4401/, {
      timeout: 20_000,
    });

    await page.getByTestId("aba-conhecimento-documentos").click();
    const upScan = page.waitForResponse(
      (r) => r.url().includes("/sources/upload") && r.request().method() === "POST",
    );
    await page.getByTestId("conhecimento-upload-input").setInputFiles(join(FIX, "pdf-escaneado.pdf"));
    const scan = await upScan;
    expect(scan.status()).toBe(201);
    const scanBody = (await scan.json()) as {
      data?: { extract_status?: string; error_code?: string };
    };
    expect(scanBody.data?.extract_status).toBe("needs_ocr");
    await expect(page.getByText(/OCR necessário|digitalizado/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const upEnc = page.waitForResponse(
      (r) => r.url().includes("/sources/upload") && r.request().method() === "POST",
    );
    await page.getByTestId("conhecimento-upload-input").setInputFiles(join(FIX, "pdf-protegido.pdf"));
    const enc = await upEnc;
    expect(enc.status()).toBe(422);
    const encBody = (await enc.json()) as { error?: { code?: string; message?: string } };
    expect(encBody.error?.code).toBe("pdf_encrypted");
    expect(encBody.error?.message).toMatch(/senha/);

    await login(page, orgB.email);
    await page.goto("/app/ai/knowledge/sources");
    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual o preco da Plataforma Elevatoria TESTE PDF REAL?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-vazio")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("body")).not.toContainText("742,30");
    await expect(page.locator("body")).not.toContainText("PDFREAL-8127");
  });
});
