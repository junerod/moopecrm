/**
 * Cockpit comercial na Inbox — a ficha opera o lead OPEN sem ir ao quadro.
 *
 * Semeia contato/conversa/mensagem direto (histórico). Não passa pelo WAHA.
 * Não toca na sessão WORKING da 3B.3.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");

interface Creds {
  password: string;
  org_id: string;
  users: Record<string, { id: string; email: string; role: string }>;
}

const env = carregarEnvLocal();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const creds: Creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
const SUFIXO = Date.now().toString(36);

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

async function sessaoDaOrg(): Promise<string> {
  const { data } = await admin
    .from("channel_sessions")
    .select("id")
    .eq("organization_id", creds.org_id)
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id as string;
  const { data: criada, error } = await admin
    .from("channel_sessions")
    .insert({
      organization_id: creds.org_id,
      waha_session_name: `e2e-cockpit-${SUFIXO}`,
      webhook_secret_encrypted: "e2e",
    })
    .select("id")
    .single();
  if (error || !criada) throw new Error(`channel_sessions: ${error?.message}`);
  return (criada as { id: string }).id;
}

async function funilPadrao(): Promise<{
  pipelineId: string;
  pipelineName: string;
  isDefault: boolean;
  stages: Array<{ id: string; name: string }>;
}> {
  const { data: funil, error } = await admin
    .from("crm_pipelines")
    .select("id, name, is_default, crm_stages(id, name, position, is_won, is_lost, is_archived)")
    .eq("organization_id", creds.org_id)
    .eq("is_archived", false)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !funil) throw new Error(`funil: ${error?.message ?? "nenhum"}`);
  const stages = (
    (funil as { crm_stages: Array<{ id: string; name: string; is_won: boolean; is_lost: boolean; is_archived: boolean; position: number }> })
      .crm_stages ?? []
  )
    .filter((s) => !s.is_won && !s.is_lost && !s.is_archived)
    .sort((a, b) => a.position - b.position);
  if (stages.length < 2) throw new Error("funil de teste precisa de 2 etapas abertas");
  return {
    pipelineId: (funil as { id: string }).id,
    pipelineName: (funil as { name: string }).name,
    isDefault: Boolean((funil as { is_default: boolean }).is_default),
    stages: stages.map((s) => ({ id: s.id, name: s.name })),
  };
}

async function semearConversa(nome: string, comLead: boolean, extras?: { segundoLead?: boolean; owner?: { user?: string; agent?: string } }) {
  const sessaoId = await sessaoDaOrg();
  const funil = await funilPadrao();
  const { data: contato, error: erroContato } = await admin
    .from("contacts")
    .insert({
      organization_id: creds.org_id,
      display_name: nome,
      phone_number: `+55119${String(Date.now()).slice(-7)}${String(Math.floor(Math.random() * 90) + 10)}`,
    })
    .select("id")
    .single();
  if (erroContato || !contato) throw new Error(`contacts: ${erroContato?.message}`);
  const contatoId = (contato as { id: string }).id;

  const agora = new Date().toISOString();
  const { data: conversa, error: erroConversa } = await admin
    .from("conversations")
    .insert({
      organization_id: creds.org_id,
      contact_id: contatoId,
      channel_session_id: sessaoId,
      status: "open",
      last_message_preview: "Quanto custa?",
      last_message_at: agora,
      last_inbound_at: agora,
    })
    .select("id")
    .single();
  if (erroConversa || !conversa) throw new Error(`conversations: ${erroConversa?.message}`);
  const conversaId = (conversa as { id: string }).id;

  const { error: erroMsg } = await admin.from("messages").insert({
    organization_id: creds.org_id,
    conversation_id: conversaId,
    channel_session_id: sessaoId,
    contact_id: contatoId,
    type: "text",
    direction: "inbound",
    body: "Quanto custa a MOOPE?",
  });
  if (erroMsg) throw new Error(`messages: ${erroMsg.message}`);

  const leads: string[] = [];
  if (comLead) {
    const { data: lead, error } = await admin
      .from("crm_leads")
      .insert({
        organization_id: creds.org_id,
        contact_id: contatoId,
        pipeline_id: funil.pipelineId,
        stage_id: funil.stages[0]!.id,
        title: nome,
        source: "whatsapp",
        owner_user_id: extras?.owner?.user ?? null,
        owner_agent_id: extras?.owner?.agent ?? null,
        owner_kind: extras?.owner?.user ? "user" : extras?.owner?.agent ? "ai" : null,
      })
      .select("id")
      .single();
    if (error || !lead) throw new Error(`crm_leads: ${error?.message}`);
    leads.push((lead as { id: string }).id);
    if (extras?.segundoLead) {
      const { data: lead2, error: err2 } = await admin
        .from("crm_leads")
        .insert({
          organization_id: creds.org_id,
          contact_id: contatoId,
          pipeline_id: funil.pipelineId,
          stage_id: funil.stages[1]!.id,
          title: `${nome} — segundo`,
          source: "manual",
        })
        .select("id")
        .single();
      if (err2 || !lead2) throw new Error(`crm_leads 2: ${err2?.message}`);
      leads.push((lead2 as { id: string }).id);
    }
  }

  return { contatoId, conversaId, leads, funil };
}

test.describe("Inbox — cockpit comercial", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeAll(() => {
    if (!fs.existsSync(CREDS_PATH)) {
      execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
    }
  });

  test("A — lead existente: etapa, refresh e abrir no quadro", async ({ page }) => {
    const nome = `Cockpit A ${SUFIXO}`;
    const { conversaId, leads, funil } = await semearConversa(nome, true);
    await login(page, creds.users.manager!.email);
    await page.goto(`/app/inbox/${conversaId}`);
    await expect(page.getByTestId("inbox-ficha-negocio")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("inbox-negocio-funil")).toContainText(funil.pipelineName);
    await expect(page.getByTestId("inbox-negocio-etapa")).toHaveValue(funil.stages[0]!.id);

    await page.getByTestId("inbox-negocio-etapa").selectOption(funil.stages[1]!.id);
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByTestId("inbox-negocio-etapa")).toHaveValue(funil.stages[1]!.id, {
      timeout: 20_000,
    });

    const { data: noBanco } = await admin.from("crm_leads").select("stage_id").eq("id", leads[0]!).single();
    expect((noBanco as { stage_id: string }).stage_id).toBe(funil.stages[1]!.id);

    await page.getByTestId("inbox-abrir-no-quadro").click();
    await page.waitForURL(new RegExp(`/app/pipelines/${funil.pipelineId}\\?lead=${leads[0]}`), {
      timeout: 20_000,
    });
  });

  test("B — conversa histórica vira um lead sem perder mensagens", async ({ page }) => {
    const nome = `Cockpit B ${SUFIXO}`;
    const { conversaId, contatoId } = await semearConversa(nome, false);
    const { count: msgsAntes } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversaId);

    await login(page, creds.users.manager!.email);
    await page.goto(`/app/inbox/${conversaId}`);
    await expect(page.getByTestId("inbox-adicionar-ao-funil")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("inbox-adicionar-ao-funil").click();
    await expect(page.getByTestId("inbox-negocio-unico")).toBeVisible({ timeout: 20_000 });

    const { data: abertos } = await admin
      .from("crm_leads")
      .select("id")
      .eq("contact_id", contatoId)
      .eq("status", "open");
    expect(abertos ?? []).toHaveLength(1);

    const { count: msgsDepois } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversaId);
    expect(msgsDepois).toBe(msgsAntes);
  });

  test("C — próximo passo texto + quando persiste", async ({ page }) => {
    const nome = `Cockpit C ${SUFIXO}`;
    const { conversaId } = await semearConversa(nome, true);
    await login(page, creds.users.manager!.email);
    await page.goto(`/app/inbox/${conversaId}`);
    await page.getByTestId("inbox-definir-proximo-passo").click();
    await expect(page.getByTestId("inbox-proximo-passo-texto")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("inbox-proximo-passo-texto").fill("Ligar amanhã");
    await page.getByTestId("inbox-proximo-passo-data").fill("2026-09-12");
    await page.getByTestId("inbox-proximo-passo-hora").fill("10:00");
    await page.getByTestId("inbox-salvar-proximo-passo").click();
    await page.waitForTimeout(800);
    await page.reload();
    await expect(page.getByTestId("inbox-proximo-passo").getByText("Ligar amanhã")).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId("inbox-editar-proximo-passo").click();
    await expect(page.getByTestId("inbox-proximo-passo-texto")).toHaveValue("Ligar amanhã", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("inbox-proximo-passo-data")).not.toHaveValue("");
  });

  test("D — Assumir preenche owner vazio e não sobrescreve", async ({ page }) => {
    const agente = creds.users.agent!;
    const manager = creds.users.manager!;

    const vazio = await semearConversa(`Cockpit D vazio ${SUFIXO}`, true);
    const comHumano = await semearConversa(`Cockpit D humano ${SUFIXO}`, true, {
      owner: { user: manager.id },
    });

    await login(page, agente.email);
    const r1 = await page.request.post(`/api/v1/conversations/${vazio.conversaId}/claim`, {
      data: { expected_assignee: null },
    });
    expect(r1.ok(), await r1.text()).toBeTruthy();
    const { data: leadVazio } = await admin
      .from("crm_leads")
      .select("owner_user_id, owner_agent_id")
      .eq("id", vazio.leads[0]!)
      .single();
    expect((leadVazio as { owner_user_id: string | null }).owner_user_id).toBe(agente.id);
    expect((leadVazio as { owner_agent_id: string | null }).owner_agent_id).toBeNull();

    const r2 = await page.request.post(`/api/v1/conversations/${comHumano.conversaId}/claim`, {
      data: { expected_assignee: null },
    });
    expect(r2.ok(), await r2.text()).toBeTruthy();
    const { data: leadHumano } = await admin
      .from("crm_leads")
      .select("owner_user_id")
      .eq("id", comHumano.leads[0]!)
      .single();
    expect((leadHumano as { owner_user_id: string }).owner_user_id).toBe(manager.id);
  });

  test("D2 — owner_agent não é apagado ao assumir", async ({ page }) => {
    const { data: agenteIa } = await admin
      .from("ai_agents")
      .select("id")
      .eq("organization_id", creds.org_id)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();
    test.skip(!agenteIa, "org de e2e sem agente de IA — cenário C de owner fica para o unitário");
    const semente = await semearConversa(`Cockpit D agente ${SUFIXO}`, true, {
      owner: { agent: (agenteIa as { id: string }).id },
    });
    await login(page, creds.users.agent!.email);
    await page.request.post(`/api/v1/conversations/${semente.conversaId}/claim`, {
      data: { expected_assignee: null },
    });
    const { data: lead } = await admin
      .from("crm_leads")
      .select("owner_user_id, owner_agent_id")
      .eq("id", semente.leads[0]!)
      .single();
    expect((lead as { owner_agent_id: string }).owner_agent_id).toBe((agenteIa as { id: string }).id);
    expect((lead as { owner_user_id: string | null }).owner_user_id).toBeNull();
  });

  test("E — dois OPEN: a ficha não escolhe", async ({ page }) => {
    const nome = `Cockpit E ${SUFIXO}`;
    const { conversaId, leads } = await semearConversa(nome, true, { segundoLead: true });
    await login(page, creds.users.manager!.email);
    await page.goto(`/app/inbox/${conversaId}`);
    await expect(page.getByTestId("inbox-negocios-varios")).toBeVisible({ timeout: 30_000 });
    expect(await page.getByTestId("inbox-lead-aberto").count()).toBe(2);
    await expect(page.getByTestId("inbox-negocio-etapa")).toHaveCount(0);
    await page.getByTestId("inbox-lead-aberto").first().click();
    await page.waitForURL(new RegExp(`/app/leads/${leads[0]}|/app/pipelines/.*lead=`), {
      timeout: 20_000,
    });
  });

  test("F — POST reuse_open duas vezes não duplica", async ({ page }) => {
    const { contatoId, funil } = await semearConversa(`Cockpit F ${SUFIXO}`, false);
    await login(page, creds.users.manager!.email);
    const corpo = {
      pipeline_id: funil.pipelineId,
      stage_id: funil.stages[0]!.id,
      title: `Reuse ${SUFIXO}`,
      contact_id: contatoId,
      source: "whatsapp",
      reuse_open_if_exists: true,
    };
    const a = page.request.post("/api/v1/leads", { data: corpo });
    const b = page.request.post("/api/v1/leads", { data: corpo });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra.ok(), await ra.text()).toBeTruthy();
    expect(rb.ok(), await rb.text()).toBeTruthy();
    const { data: abertos } = await admin
      .from("crm_leads")
      .select("id")
      .eq("contact_id", contatoId)
      .eq("status", "open");
    expect(abertos ?? []).toHaveLength(1);
  });

  test("G — crm-summary de outro tenant não vaza", async ({ page }) => {
    const { data: orgB, error } = await admin
      .from("organizations")
      .insert({
        slug: `e2e-cockpit-b-${SUFIXO}`,
        legal_name: "Org B Cockpit",
        display_name: "Org B Cockpit",
      })
      .select("id")
      .single();
    if (error || !orgB) throw new Error(`org B: ${error?.message}`);
    const { data: contatoB, error: errC } = await admin
      .from("contacts")
      .insert({
        organization_id: (orgB as { id: string }).id,
        display_name: "Segredo B",
        phone_number: `+55118${String(Date.now()).slice(-8)}`,
      })
      .select("id")
      .single();
    if (errC || !contatoB) throw new Error(`contato B: ${errC?.message}`);

    await login(page, creds.users.manager!.email);
    const res = await page.request.get(`/api/v1/contacts/${(contatoB as { id: string }).id}/crm-summary`);
    expect(res.status()).toBe(404);

    await admin.from("organizations").delete().eq("id", (orgB as { id: string }).id);
  });

  test("mobile 390x844: controles cabem na ficha", async ({ page }) => {
    const { conversaId } = await semearConversa(`Cockpit M ${SUFIXO}`, true);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, creds.users.manager!.email);
    await page.goto(`/app/inbox/${conversaId}`);
    await page.getByRole("button", { name: /ficha/i }).click();
    const dialogo = page.getByRole("dialog", { name: /ficha do contato/i });
    const ficha = dialogo.getByTestId("inbox-ficha-negocio");
    await expect(ficha).toBeVisible({ timeout: 30_000 });
    const box = await ficha.boundingBox();
    expect(box, "ficha visível").toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(390);
    await expect(dialogo.getByTestId("inbox-negocio-etapa")).toBeVisible();
    await expect(dialogo.getByTestId("inbox-abrir-no-quadro")).toBeVisible();
    await dialogo.getByTestId("inbox-definir-proximo-passo").click();
    await expect(dialogo.getByTestId("inbox-proximo-passo-texto")).toBeVisible();
    const overflow = await dialogo.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(overflow, "sem overflow horizontal").toBe(false);
  });

  test("E — Comercial esconde Equipe; ficha edita papel no viewport estreito", async ({ page }) => {
    const equipe = await semearConversa(`Tec Equipe ${SUFIXO}`, false);
    const { error: erroPapel } = await admin
      .from("contacts")
      .update({ papel: "equipe", name: `Tec Equipe ${SUFIXO}` })
      .eq("id", equipe.contatoId);
    if (erroPapel) throw new Error(`papel equipe: ${erroPapel.message}`);
    const comercial = await semearConversa(`Lead Novo ${SUFIXO}`, false);

    await login(page, creds.users.manager!.email);

    const listaComercial = await page.request.get("/api/v1/conversations?papel=comercial&limit=100");
    expect(listaComercial.ok(), await listaComercial.text()).toBeTruthy();
    const idsComercial = ((await listaComercial.json()) as { data?: Array<{ id: string }> }).data?.map(
      (c) => c.id,
    ) ?? [];
    expect(idsComercial).toContain(comercial.conversaId);
    expect(idsComercial).not.toContain(equipe.conversaId);

    const listaEquipe = await page.request.get("/api/v1/conversations?papel=equipe&limit=100");
    expect(listaEquipe.ok(), await listaEquipe.text()).toBeTruthy();
    const idsEquipe = ((await listaEquipe.json()) as { data?: Array<{ id: string }> }).data?.map(
      (c) => c.id,
    ) ?? [];
    expect(idsEquipe).toContain(equipe.conversaId);

    await page.goto(`/app/inbox/${equipe.conversaId}`);
    await expect(page.getByTestId("selo-da-pessoa").first()).toHaveAttribute("data-selo", "equipe", {
      timeout: 30_000,
    });
    await expect(page.getByTestId("conversa-da-equipe")).toBeVisible();
    await page.getByRole("button", { name: "Mais ações" }).click();
    await expect(page.getByTestId("marcar-pessoa")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: /ficha/i }).click();
    const dialogo = page.getByRole("dialog", { name: /ficha do contato/i });
    await expect(dialogo.getByTestId("chip-papel-lead")).toBeVisible();
    await dialogo.getByTestId("chip-papel-lead").click();
    await expect(dialogo.getByTestId("inbox-ficha-negocio")).toBeVisible({ timeout: 20_000 });

    const { data: contato } = await admin
      .from("contacts")
      .select("papel")
      .eq("id", equipe.contatoId)
      .single();
    expect((contato as { papel: string }).papel).toBe("lead");
  });
});
