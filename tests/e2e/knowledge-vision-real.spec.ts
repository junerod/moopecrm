/**
 * Prova de Vision REAL: a informação existe só nos pixels.
 * Sem mock. Sem TXT/MD/PDF auxiliar com o token.
 * Se a instalação não tiver modelo multimodal resolvível, o teste é pulado
 * (CI sem chave) — a certificação registra VISION REAL: NÃO.
 */
import { randomUUID } from "node:crypto";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { gravarPngCampanha, TOKEN_VISUAL_CAMPANHA } from "@/tests/fixtures/knowledge/campanha-png";
import { gravarPdfVisual, TOKEN_VISUAL_PDF } from "@/tests/fixtures/knowledge/pdf-visual";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "WizardQa!2026#Deskcomm";

type Conta = { email: string; userId: string; orgId: string };

type Fonte = {
  id: string;
  agent_id: string;
  name?: string | null;
  source_metadata?: {
    filename?: string;
    processing?: {
      pages_vision?: number;
      vision_requested?: boolean;
      vision_completed?: boolean;
      vision_model?: string;
      vision_provider?: string;
      vision_processed_at?: string;
      derived_revision?: number;
    };
    visual_pages_count?: number;
    collection_ids?: string[];
  };
};

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

async function listarFontes(request: APIRequestContext): Promise<Fonte[]> {
  const res = await request.get("/api/v1/ai/knowledge/sources");
  expect(res.ok()).toBeTruthy();
  const json = (await res.json()) as { data?: Fonte[] };
  return json.data ?? [];
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

test.describe("Knowledge Vision real", () => {
  test.setTimeout(360_000);
  let orgA: Conta | null = null;
  let orgB: Conta | null = null;

  test.afterAll(async () => {
    await apagar(orgA);
    await apagar(orgB);
  });

  test("pixels → Vision → retrieval → citação da imagem; reprocess reexecuta", async ({ page }) => {
    orgA = await criarConta("kvr-a", "Org A Vision");
    orgB = await criarConta("kvr-b", "Org B Vision");

    await login(page, orgA.email);
    await page.goto("/app/ai/knowledge/sources");
    await expect(page.getByRole("heading", { name: "Ensine a MOOPE" })).toBeVisible();

    const saudeRes = await page.request.get("/api/v1/ai/knowledge/saude");
    expect(saudeRes.ok()).toBeTruthy();
    const saude = (await saudeRes.json()) as {
      data?: {
        vision?: {
          available?: boolean;
          provider?: string | null;
          model?: string | null;
          missing?: string;
        };
      };
    };
    const vision = saude.data?.vision;
    test.info().annotations.push({
      type: "vision-saude",
      description: JSON.stringify({
        available: vision?.available === true,
        provider: vision?.provider ?? null,
        model: vision?.model ?? null,
        missing: vision?.missing ?? null,
      }),
    });
    test.skip(
      vision?.available !== true,
      `VISION REAL: NÃO — ${vision?.missing ?? "modelo multimodal não resolvível"}`,
    );

    const png = gravarPngCampanha();
    const upload = page.waitForResponse(
      (r) => r.url().includes("/api/v1/ai/knowledge/sources/upload") && r.request().method() === "POST",
      { timeout: 180_000 },
    );
    await page.getByTestId("conhecimento-upload-input").setInputFiles(png);
    const up = await upload;
    expect(up.ok(), `upload falhou ${up.status()}`).toBeTruthy();

    const fontes = await listarFontes(page.request);
    expect(fontes).toHaveLength(1);
    const imagem = fontes[0]!;
    expect((imagem.source_metadata?.filename ?? imagem.name ?? "")).toMatch(/Campanha-Locadoras\.png$/);
    expect(fontes.some((f) => (f.source_metadata?.filename ?? f.name ?? "").endsWith(".txt"))).toBeFalsy();

    const proc = imagem.source_metadata?.processing;
    expect(proc?.vision_requested, "VISION REQUESTED").toBeTruthy();
    expect(proc?.vision_completed, "VISION COMPLETED").toBeTruthy();
    expect((proc?.pages_vision ?? 0) > 0 || (imagem.source_metadata?.visual_pages_count ?? 0) > 0).toBeTruthy();
    expect(proc?.vision_provider).toBeTruthy();
    expect(proc?.vision_model).toBeTruthy();
    expect(proc?.derived_revision).toBe(1);
    test.info().annotations.push({
      type: "vision-upload",
      description: JSON.stringify({
        provider: proc?.vision_provider,
        model: proc?.vision_model,
        vision_requested: proc?.vision_requested,
        vision_completed: proc?.vision_completed,
        pages_vision: proc?.pages_vision,
        derived_revision: proc?.derived_revision,
        processed_at: proc?.vision_processed_at,
      }),
    });

    const { data: rows } = await svc
      .from("ai_knowledge_sources")
      .select("id, name, source_metadata")
      .eq("organization_id", orgA.orgId);
    const comToken = (rows ?? []).filter((r) => {
      const blob = JSON.stringify(r);
      return blob.includes(TOKEN_VISUAL_CAMPANHA);
    });
    expect(comToken).toHaveLength(1);
    expect(comToken[0]?.id).toBe(imagem.id);

    const { data: fonteDb } = await svc
      .from("ai_knowledge_sources")
      .select("id, source_metadata")
      .eq("id", imagem.id)
      .eq("organization_id", orgA.orgId)
      .maybeSingle();
    const metaDb = (fonteDb?.source_metadata ?? {}) as Record<string, unknown>;
    const derivadoGuardado = JSON.stringify({
      extracted: metaDb.extracted_text,
      visual: metaDb.visual_pages,
      derived: metaDb.derived_chunks,
    });
    expect(
      derivadoGuardado.includes(TOKEN_VISUAL_CAMPANHA),
      `token ausente no derivado (Vision não leu os pixels): ${derivadoGuardado.slice(0, 500)}`,
    ).toBeTruthy();

    const { data: faqs } = await svc
      .from("ai_faq_items")
      .select("id, answer, knowledge_source_id")
      .eq("organization_id", orgA.orgId);
    expect((faqs ?? []).every((f) => f.knowledge_source_id === imagem.id)).toBeTruthy();

    const codigo = await perguntarApi(
      page.request,
      "Qual é o código exclusivo mostrado na propaganda?",
    );
    expect(codigo.encontrou).toBeTruthy();
    const blobCodigo = codigo.trechos.map((t) => `${t.fonte ?? ""} ${t.texto}`).join("\n");
    expect(blobCodigo).toContain(TOKEN_VISUAL_CAMPANHA);
    expect(blobCodigo).toMatch(/Campanha-Locadoras\.png/);
    expect(blobCodigo).not.toMatch(/Campanha-Locadoras\.txt|resumo da IA|resumo gerado pela IA/i);

    const recursos = await perguntarApi(
      page.request,
      "Quais recursos da MOOPE aparecem nessa propaganda?",
    );
    expect(recursos.encontrou).toBeTruthy();
    const blobRec = recursos.trechos.map((t) => `${t.fonte ?? ""} ${t.texto}`).join("\n");
    expect(blobRec).toMatch(/Locações|Financeiro|Boleto|PIX|Manutenções|investidores|Rastreamento|WhatsApp|Vistorias|Relatórios/i);
    expect(blobRec).toMatch(/Campanha-Locadoras\.png/);

    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(
      "A propaganda informa integração com SAP?",
    );
    await page.getByRole("button", { name: "Perguntar" }).click();
    const sapVazio = page.getByTestId("testar-conhecimento-vazio");
    const sapResp = page.getByTestId("testar-conhecimento-resposta");
    await expect(sapVazio.or(sapResp)).toBeVisible({ timeout: 20_000 });
    if (await sapResp.count()) {
      await expect(sapResp).not.toContainText(/integra(ção|cao) com SAP|possui SAP|tem SAP/i);
    }

    await page.getByTestId("aba-conhecimento-colecoes").click();
    await page.getByTestId("colecao-nova-nome").fill("Comercial MOOPE");
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByTestId("colecao-comercial-moope")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("colecao-nova-nome").fill("Suporte MOOPE");
    await page.getByRole("button", { name: "Criar" }).click();
    await expect(page.getByTestId("colecao-suporte-moope")).toBeVisible({ timeout: 10_000 });

    const colRes = await page.request.get("/api/v1/ai/knowledge/collections");
    const colJson = (await colRes.json()) as { data?: { colecoes?: Array<{ id: string; slug: string }> } };
    const comercialCol = colJson.data?.colecoes?.find((c) => c.slug === "comercial-moope");
    const suporteCol = colJson.data?.colecoes?.find((c) => c.slug === "suporte-moope");
    expect(comercialCol && suporteCol).toBeTruthy();

    const link = await page.request.patch(`/api/v1/ai/knowledge/sources/${imagem.id}`, {
      data: { collection_ids: [comercialCol!.id] },
    });
    expect(link.ok()).toBeTruthy();

    const agentId = imagem.agent_id;
    const soSuporte = await page.request.patch(`/api/v1/ai/agents/${agentId}`, {
      data: { config: { knowledge_collection_ids: [suporteCol!.id] } },
    });
    expect(soSuporte.ok()).toBeTruthy();
    const suporteAsk = await perguntarApi(page.request, TOKEN_VISUAL_CAMPANHA, agentId);
    expect(
      suporteAsk.trechos.some((t) => t.texto.includes(TOKEN_VISUAL_CAMPANHA)),
      "assistente de suporte não deve recuperar a imagem comercial",
    ).toBeFalsy();

    await page.request.patch(`/api/v1/ai/agents/${agentId}`, {
      data: { config: { knowledge_collection_ids: [comercialCol!.id] } },
    });
    const comercialAsk = await perguntarApi(page.request, TOKEN_VISUAL_CAMPANHA, agentId);
    expect(comercialAsk.encontrou).toBeTruthy();
    expect(comercialAsk.trechos.some((t) => t.texto.includes(TOKEN_VISUAL_CAMPANHA))).toBeTruthy();

    await page.request.patch(`/api/v1/ai/agents/${agentId}`, {
      data: { config: { knowledge_collection_ids: [] } },
    });

    const revisaoAntes = proc?.derived_revision ?? 1;
    const quandoAntes = proc?.vision_processed_at;
    const reindex = await page.request.post(`/api/v1/ai/knowledge/sources/${imagem.id}/reindex`);
    expect(reindex.ok()).toBeTruthy();
    const reindexJson = (await reindex.json()) as {
      data?: { derived_revision?: number; vision_completed?: boolean; preserved_previous?: boolean };
    };
    expect(reindexJson.data?.vision_completed).toBeTruthy();
    expect(reindexJson.data?.derived_revision).toBeGreaterThan(revisaoAntes);

    const depois = await listarFontes(page.request);
    expect(depois).toHaveLength(1);
    expect(depois[0]?.id).toBe(imagem.id);
    const proc2 = depois[0]?.source_metadata?.processing;
    expect(proc2?.vision_completed).toBeTruthy();
    expect(proc2?.derived_revision).toBeGreaterThan(revisaoAntes);
    expect(proc2?.vision_processed_at).toBeTruthy();
    if (quandoAntes) expect(proc2?.vision_processed_at).not.toBe(quandoAntes);
    expect(depois[0]?.source_metadata?.collection_ids).toEqual([comercialCol!.id]);

    const { count: fontesAtivas } = await svc
      .from("ai_knowledge_sources")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgA.orgId)
      .eq("is_active", true);
    expect(fontesAtivas).toBe(1);

    const { data: faqsDepois } = await svc
      .from("ai_faq_items")
      .select("id")
      .eq("organization_id", orgA.orgId)
      .eq("knowledge_source_id", imagem.id);
    expect((faqsDepois ?? []).length).toBeLessThanOrEqual(1);

    const pdf = gravarPdfVisual();
    const uploadPdf = page.waitForResponse(
      (r) => r.url().includes("/api/v1/ai/knowledge/sources/upload") && r.request().method() === "POST",
      { timeout: 180_000 },
    );
    await page.getByTestId("aba-conhecimento-documentos").click();
    await page.getByTestId("conhecimento-upload-input").setInputFiles(pdf);
    const upPdf = await uploadPdf;
    expect(upPdf.ok(), `upload PDF falhou ${upPdf.status()}`).toBeTruthy();

    const fontesPdf = await listarFontes(page.request);
    const manual = fontesPdf.find((f) => (f.source_metadata?.filename ?? f.name ?? "").includes("Manual-Teste.pdf"));
    expect(manual).toBeTruthy();
    const pdfVision = (manual?.source_metadata?.processing?.pages_vision ?? 0) > 0;
    const { data: pdfDb } = await svc
      .from("ai_knowledge_sources")
      .select("source_metadata")
      .eq("id", manual!.id)
      .eq("organization_id", orgA.orgId)
      .maybeSingle();
    const pdfTemToken = JSON.stringify(pdfDb?.source_metadata ?? {}).includes(TOKEN_VISUAL_PDF);
    test.info().annotations.push({
      type: "pdf-vision",
      description: pdfVision && pdfTemToken ? "SIM" : `NÃO — vision=${pdfVision} token=${pdfTemToken}`,
    });
    if (pdfVision && pdfTemToken) {
      // "8821" não colide com VISION-MOOPE-7319 da imagem.
      const tela = await perguntarApi(page.request, "8821");
      expect(tela.encontrou).toBeTruthy();
      const blobTela = tela.trechos.map((t) => `${t.fonte ?? ""} ${t.texto}`).join("\n");
      expect(blobTela).toMatch(/8821|TELA-VISION-8821/);
      expect(blobTela).toMatch(/Manual-Teste\.pdf/);
    }

    await login(page, orgB.email);
    await page.goto("/app/ai/knowledge/sources");
    await page.getByTestId("aba-conhecimento-testar").click();
    await page.getByTestId("testar-conhecimento-pergunta").fill(TOKEN_VISUAL_CAMPANHA);
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByTestId("testar-conhecimento-vazio")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("testar-conhecimento-resposta")).toHaveCount(0);
  });
});
