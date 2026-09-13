/**
 * Knowledge multimodal + coleções — extensão do RAG existente.
 * Sem WhatsApp real. Sem segundo vector DB. Vision real só se o gateway existir.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { gravarPngCampanha } from "@/tests/fixtures/knowledge/campanha-png";
import {
  gravarPdfManualMisto,
  gravarTxtComercial,
  gravarTxtInjecao,
} from "@/tests/fixtures/knowledge/manual-misto";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "WizardQa!2026#Deskcomm";
const SHOTS = path.join(process.cwd(), "docs/knowledge-multimodal/screenshots");

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

async function shot(page: Page, nome: string): Promise<void> {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, nome), fullPage: true });
}

async function uploadArquivo(page: Page, arquivo: string): Promise<void> {
  const upload = page.waitForResponse(
    (r) => r.url().includes("/api/v1/ai/knowledge/sources/upload") && r.request().method() === "POST",
    { timeout: 90_000 },
  );
  await page.getByTestId("conhecimento-upload-input").setInputFiles(arquivo);
  const res = await upload;
  expect(res.ok(), `upload falhou ${res.status()}`).toBeTruthy();
}

async function perguntarApi(
  request: APIRequestContext,
  pergunta: string,
  agentId?: string,
): Promise<{ encontrou: boolean; trechos: Array<{ texto: string; fonte: string | null }> }> {
  const res = await request.post("/api/v1/ai/knowledge/consultar", {
    data: { pergunta, ...(agentId ? { agent_id: agentId } : {}) },
  });
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as {
    data?: { encontrou: boolean; trechos: Array<{ texto: string; fonte: string | null }> };
  };
  return json.data ?? { encontrou: false, trechos: [] };
}

test.describe("Knowledge multimodal", () => {
  test.setTimeout(240_000);
  let orgA: Conta | null = null;
  let orgB: Conta | null = null;

  test.afterAll(async () => {
    await apagar(orgA);
    await apagar(orgB);
  });

  test("PDF + imagem + coleções + isolamento + delete", async ({ page }) => {
    orgA = await criarConta("kmm-a", "Org A Multimodal");
    orgB = await criarConta("kmm-b", "Org B Multimodal");

    await login(page, orgA.email);
    await page.goto("/app/ai/knowledge/sources");
    await expect(page.getByRole("heading", { name: "Ensine a MOOPE" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Conhecimento da Empresa" })).toBeVisible();
    await shot(page, "01-documentos.png");

    await uploadArquivo(page, gravarPdfManualMisto());
    await shot(page, "02-upload.png");
    await expect(page.getByText(/documento enviado/i)).toBeVisible({ timeout: 15_000 });
    await shot(page, "03-processando.png");
    await expect(page.getByTestId("conhecimento-lista-documentos")).toBeVisible({ timeout: 20_000 });

    await uploadArquivo(page, gravarTxtComercial());
    await uploadArquivo(page, gravarPngCampanha());
    await uploadArquivo(page, gravarTxtInjecao());
    await expect(page.locator("[data-testid='conhecimento-lista-documentos'] li").nth(2)).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId("conhecimento-doc-nome").first().click();
    await expect(page.getByTestId("conhecimento-detalhe")).toBeVisible();
    await expect(page.getByTestId("o-que-aprendeu")).toBeVisible();
    await shot(page, "04-documento-pronto.png");
    await shot(page, "05-o-que-aprendeu.png");
    await page.getByRole("button", { name: "Fechar" }).click();

    const fontesRes = await page.request.get("/api/v1/ai/knowledge/sources");
    const fontesJson = (await fontesRes.json()) as {
      data?: Array<{ id: string; agent_id: string; name?: string | null; source_metadata?: { filename?: string } }>;
    };
    const fontes = fontesJson.data ?? [];
    const agentId = fontes[0]?.agent_id;
    expect(agentId).toBeTruthy();
    const manual = fontes.find((f) => (f.source_metadata?.filename ?? f.name ?? "").includes("Manual"));
    const comercial = fontes.find((f) => (f.source_metadata?.filename ?? f.name ?? "").includes("Campanha-Locadoras.txt"));
    const imagem = fontes.find((f) => (f.source_metadata?.filename ?? f.name ?? "").endsWith(".png"));
    expect(manual && comercial && imagem).toBeTruthy();

    await page.getByTestId("aba-conhecimento-colecoes").click();
    await expect(page.getByTestId("conhecimento-colecoes")).toBeVisible();
    await page.getByTestId("colecao-nova-nome").fill("Suporte MOOPE");
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByTestId("colecao-suporte-moope")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("colecao-nova-nome").fill("Comercial MOOPE");
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByTestId("colecao-comercial-moope")).toBeVisible({ timeout: 10_000 });
    await shot(page, "06-colecoes.png");

    const colRes = await page.request.get("/api/v1/ai/knowledge/collections");
    const colJson = (await colRes.json()) as { data?: { colecoes?: Array<{ id: string; slug: string }> } };
    const colecoes = colJson.data?.colecoes ?? [];
    const suporte = colecoes.find((c) => c.slug === "suporte-moope");
    const comercialCol = colecoes.find((c) => c.slug === "comercial-moope");
    expect(suporte && comercialCol).toBeTruthy();

    const linkManual = await page.request.patch(`/api/v1/ai/knowledge/sources/${manual!.id}`, {
      data: { collection_ids: [suporte!.id] },
    });
    const linkComercial = await page.request.patch(`/api/v1/ai/knowledge/sources/${comercial!.id}`, {
      data: { collection_ids: [comercialCol!.id] },
    });
    expect(linkManual.ok()).toBeTruthy();
    expect(linkComercial.ok()).toBeTruthy();
    if (imagem) {
      await page.request.patch(`/api/v1/ai/knowledge/sources/${imagem.id}`, {
        data: { collection_ids: [comercialCol!.id] },
      });
    }

    await page.getByTestId("agente-colecao-suporte-moope").check();
    await shot(page, "07-assistente-colecoes.png");
    await page.getByTestId("salvar-colecoes-agente").click();
    await expect(page.getByText(/consulta só as coleções|assistente agora/i)).toBeVisible({
      timeout: 10_000,
    });
    const resetEscopo = await page.request.patch(`/api/v1/ai/agents/${agentId}`, {
      data: { config: { knowledge_collection_ids: [] } },
    });
    expect(resetEscopo.ok()).toBeTruthy();

    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill("Onde fica TELA-CLICK-4401?");
    await page.getByRole("button", { name: "Perguntar" }).click();
    const respManual = page.getByTestId("testar-conhecimento-resposta");
    await expect(respManual).toBeVisible({ timeout: 20_000 });
    await expect(respManual).toContainText(/TELA-CLICK-4401|Sinistros/i);
    await expect(page.getByTestId("testar-conhecimento-fontes")).toContainText(/Manual|Veiculos|\.pdf/i);
    await expect(page.getByTestId("testar-conhecimento-fontes")).not.toContainText(/resumo gerado pela IA/i);
    await shot(page, "08-teste-manual.png");

    await page.getByTestId("testar-conhecimento-pergunta").fill("Como funciona uma recorrência?");
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-resposta")).toContainText(/recorr/i);

    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Como informar o identificador do rastreador no cadastro?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-resposta")).toContainText(/rastreador|TELA-CLICK-4401/i);

    const soSuporte = await page.request.patch(`/api/v1/ai/agents/${agentId}`, {
      data: { config: { knowledge_collection_ids: [suporte!.id] } },
    });
    expect(soSuporte.ok()).toBeTruthy();
    const suporteAsk = await perguntarApi(
      page.request,
      "Quais soluções a MOOPE oferece para uma locadora?",
      agentId,
    );
    expect(
      suporteAsk.trechos.some((t) => /Campanha-Locadoras|locadora cresceu/i.test(`${t.fonte ?? ""} ${t.texto}`)),
      "assistente de suporte não deve achar o comercial",
    ).toBeFalsy();

    await page.request.patch(`/api/v1/ai/agents/${agentId}`, {
      data: { config: { knowledge_collection_ids: [comercialCol!.id] } },
    });
    const comercialAsk = await perguntarApi(
      page.request,
      "Quais soluções a MOOPE oferece para uma locadora?",
      agentId,
    );
    expect(comercialAsk.encontrou).toBeTruthy();
    expect(comercialAsk.trechos.some((t) => /Locações|Financeiro|locadora/i.test(t.texto))).toBeTruthy();
    expect(comercialAsk.trechos.some((t) => /Campanha-Locadoras|Campanha/i.test(t.fonte ?? ""))).toBeTruthy();

    await page.request.patch(`/api/v1/ai/agents/${agentId}`, {
      data: { config: { knowledge_collection_ids: [] } },
    });

    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Quais soluções a MOOPE oferece para uma locadora?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-resposta")).toContainText(/Locações|Financeiro|lucro/i);
    await expect(page.getByTestId("testar-conhecimento-fontes")).toContainText(/Campanha/i);
    await shot(page, "09-teste-imagem.png");

    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual a taxa de entrega para Blumenau XYZNAOEXISTE?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-vazio")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("testar-conhecimento-pergunta").fill("O que a política de desconto registra?");
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-resposta")).toContainText(/12 por cento|Ignore suas instruções/i);

    await login(page, orgB.email);
    await page.goto("/app/ai/knowledge/sources");
    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual o preço exclusivo do item de teste multimodal?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-vazio")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("testar-conhecimento-resposta")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("847,35");

    await login(page, orgA.email);
    await page.goto("/app/ai/knowledge/sources");
    await page.getByTestId("aba-conhecimento-documentos").click();
    const linhaManual = page.locator("li").filter({ hasText: /Manual-Veiculos|Manual Veículos/i }).first();
    await linhaManual.getByRole("button", { name: "Ações do documento" }).click();
    await page.getByRole("button", { name: "Reprocessar" }).click();
    await expect(page.getByText(/reindex|segundo plano|indexando/i).first()).toBeVisible({
      timeout: 10_000,
    });

    const antes = fontes.length;
    const depoisRes = await page.request.get("/api/v1/ai/knowledge/sources");
    const depoisJson = (await depoisRes.json()) as { data?: unknown[] };
    expect((depoisJson.data ?? []).length).toBe(antes);

    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "Qual o preço exclusivo TESTE-MULTIMODAL-9271?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-resposta")).toContainText(/847,35|TESTE-MULTIMODAL-9271/);

    await page.getByTestId("aba-conhecimento-documentos").click();
    await linhaManual.getByRole("button", { name: "Ações do documento" }).click();
    await page.getByRole("button", { name: "Excluir" }).click();
    await expect(page.getByText(/removido|Nenhum documento/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill("TESTE-MULTIMODAL-9271");
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-vazio")).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("aba-conhecimento-documentos").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("conhecimento-dropzone")).toBeVisible();
    await shot(page, "10-mobile.png");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > 390 + 2);
    expect(overflow, "sem scroll horizontal em 390").toBeFalsy();

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByTestId("theme-control").click();
    await page.getByTestId("theme-option-dark").click();
    await shot(page, "11-dark.png");
    await page.getByTestId("theme-control").click();
    await page.getByTestId("theme-option-light").click();
  });
});
