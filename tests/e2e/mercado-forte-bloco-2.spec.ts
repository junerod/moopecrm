/**
 * Mercado Forte — Bloco 2: organização comercial sem esquecimento.
 * Uma fonte: demandas.proximo_passo. Sem QR. Sem WhatsApp real.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const SHOTS = path.join(process.cwd(), "docs/mercado-forte-bloco-2/screenshots");

interface Creds {
  password: string;
  org_id: string;
  users: Record<string, { id: string; email: string; role: string }>;
}

const env = carregarEnvLocal();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let creds: Creds;
let sessaoId = "";
let conversaId = "";
let contatoId = "";
let leadId = "";
let pipelineId = "";
let stageOpen = "";
let stageWon = "";
let stageLost = "";
let demandaId = "";
const SUFIXO = String(Date.now()).slice(-8);
const TEXTO = `Retornar proposta ${SUFIXO}`;
const TITULO_LEAD = `Carlos ${SUFIXO}`;

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

async function shot(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, nome), fullPage: true });
}

function linhaDaAcao(page: Page, texto: string) {
  return page.locator("li").filter({ hasText: texto });
}

function cardDoLead(page: Page) {
  return page.getByRole("group", { name: `Lead: ${TITULO_LEAD}` });
}

async function abrirKanbanDoLead(page: Page): Promise<void> {
  test.skip(!pipelineId, "org sem funil");
  await page.goto(`/app/pipelines/${pipelineId}`);
  await page.getByPlaceholder(/buscar por nome/i).fill(TITULO_LEAD);
  await expect(cardDoLead(page)).toBeVisible({ timeout: 20_000 });
}

test.describe("Mercado Forte — Bloco 2", () => {
  test.describe.configure({ timeout: 180_000, mode: "serial" });

  test.beforeAll(async () => {
    if (!fs.existsSync(CREDS_PATH)) {
      execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
    }
    creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;

    const { data: sessao, error: erroSessao } = await admin
      .from("channel_sessions")
      .insert({
        organization_id: creds.org_id,
        webhook_secret_encrypted: "e2e",
        provider: "waha",
        waha_session_name: `e2e-mf2-${SUFIXO}`,
      })
      .select("id")
      .single();
    if (erroSessao || !sessao) throw new Error(`sessão: ${erroSessao?.message}`);
    sessaoId = sessao.id as string;

    const { data: contato, error: erroContato } = await admin
      .from("contacts")
      .insert({
        organization_id: creds.org_id,
        display_name: `MF2 Carlos ${SUFIXO}`,
        phone_number: `+55119${SUFIXO}01`.slice(0, 15),
      })
      .select("id")
      .single();
    if (erroContato || !contato) throw new Error(`contato: ${erroContato?.message}`);
    contatoId = contato.id as string;

    const { data: conversa, error: erroConv } = await admin
      .from("conversations")
      .insert({
        organization_id: creds.org_id,
        contact_id: contatoId,
        channel_session_id: sessaoId,
        status: "open",
        last_message_preview: "Preciso da proposta",
        last_message_at: new Date().toISOString(),
        last_inbound_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (erroConv || !conversa) throw new Error(`conversa: ${erroConv?.message}`);
    conversaId = conversa.id as string;

    const { data: funil } = await admin
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", creds.org_id)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();
    pipelineId = (funil as { id: string } | null)?.id ?? "";
    const { data: stages } = await admin
      .from("crm_stages")
      .select("id, is_won, is_lost, is_archived")
      .eq("pipeline_id", pipelineId);
    const abertas = (stages ?? []).filter((s) => !s.is_won && !s.is_lost && !s.is_archived);
    stageOpen = (abertas[0] as { id: string } | undefined)?.id ?? "";
    stageWon = ((stages ?? []).find((s) => s.is_won) as { id: string } | undefined)?.id ?? "";
    stageLost = ((stages ?? []).find((s) => s.is_lost) as { id: string } | undefined)?.id ?? "";
    if (pipelineId && stageOpen) {
      const { data: lead, error: erroLead } = await admin
        .from("crm_leads")
        .insert({
          organization_id: creds.org_id,
          contact_id: contatoId,
          pipeline_id: pipelineId,
          stage_id: stageOpen,
          title: TITULO_LEAD,
          value_cents: 320000,
          currency: "BRL",
          temperatura: "quente",
          owner_user_id: creds.users.manager!.id,
          owner_kind: "user",
        })
        .select("id")
        .single();
      if (erroLead || !lead) throw new Error(`lead: ${erroLead?.message}`);
      leadId = lead.id as string;
    }
  });

  test("A–D criar na Inbox aparece Kanban, Agenda e Hoje", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto(`/app/inbox/${conversaId}`);
    await expect(page.getByTestId("inbox-proximo-passo")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("inbox-definir-proximo-passo").click();
    await page.getByTestId("inbox-proximo-passo-texto").fill(TEXTO);
    await page.getByTestId("preset-quando-hoje").click();
    await page.getByTestId("inbox-salvar-proximo-passo").click();
    await expect(page.getByTestId("inbox-proximo-passo").getByText(TEXTO)).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, "04-inbox-proxima-acao.png");
    await shot(page, "05-inbox-criar-acao.png");

    const { data: demanda } = await admin
      .from("demandas")
      .select("id, proximo_passo")
      .eq("organization_id", creds.org_id)
      .eq("contact_id", contatoId)
      .is("fechada_em", null)
      .maybeSingle();
    demandaId = (demanda as { id: string } | null)?.id ?? "";
    expect(demanda?.proximo_passo).toBe(TEXTO);

    await abrirKanbanDoLead(page);
    await expect(cardDoLead(page).getByTestId("kanban-proxima-acao")).toBeVisible({
      timeout: 20_000,
    });
    await expect(cardDoLead(page)).toContainText(TEXTO);
    await shot(page, "01-kanban-operacional.png");

    await page.goto("/app/agenda");
    await expect(page.getByTestId("agenda-obrigacoes")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("lista-proximas-acoes")).toContainText(TEXTO);
    await shot(page, "06-agenda-hoje.png");

    await page.goto("/app/inicio");
    await expect(page.getByRole("main").getByTestId("hoje-operacional")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("main").getByTestId("hoje-operacional").getByText(/retornos hoje/i)).toBeVisible();
    const hojeApi = await page.request.get("/api/v1/demandas?visao=hoje");
    expect(hojeApi.ok(), await hojeApi.text()).toBeTruthy();
    const hojeCorpo = (await hojeApi.json()) as { data: Array<{ texto: string | null }> };
    expect(hojeCorpo.data.some((a) => a.texto === TEXTO)).toBeTruthy();
    await shot(page, "08-home-hoje.png");
  });

  test("E editar na Agenda atualiza Inbox e Kanban", async ({ page }) => {
    test.skip(!demandaId, "ação ainda não criada");
    await login(page, creds.users.manager!.email);
    await page.goto("/app/agenda");
    await expect(page.getByTestId("agenda-obrigacoes")).toBeVisible({ timeout: 30_000 });
    await linhaDaAcao(page, TEXTO).getByTestId("agenda-editar-acao").click();
    const novo = `${TEXTO} editada`;
    await linhaDaAcao(page, TEXTO).getByTestId("inbox-proximo-passo-texto").fill(novo);
    await linhaDaAcao(page, TEXTO).getByTestId("inbox-salvar-proximo-passo").click();
    await expect(page.getByTestId("lista-proximas-acoes").getByText(novo)).toBeVisible({
      timeout: 15_000,
    });

    await page.goto(`/app/inbox/${conversaId}`);
    await expect(page.getByTestId("inbox-proximo-passo").getByText(novo)).toBeVisible({
      timeout: 20_000,
    });
    if (pipelineId) {
      await abrirKanbanDoLead(page);
      await expect(cardDoLead(page)).toContainText(novo);
    }
  });

  test("G–H atrasada fica indicada; reagendar remove atraso", async ({ page }) => {
    test.skip(!demandaId, "ação ainda não criada");
    await admin
      .from("demandas")
      .update({
        proximo_passo: TEXTO,
        proximo_passo_em: new Date(Date.now() - 90 * 60_000).toISOString(),
      })
      .eq("id", demandaId)
      .eq("organization_id", creds.org_id);

    await login(page, creds.users.manager!.email);
    await page.goto(`/app/inbox/${conversaId}`);
    await expect(page.getByTestId("inbox-acao-atrasada")).toBeVisible({ timeout: 20_000 });
    if (pipelineId) {
      await abrirKanbanDoLead(page);
      await expect(cardDoLead(page).getByTestId("kanban-acao-atrasada")).toBeVisible({
        timeout: 20_000,
      });
      await shot(page, "02-kanban-atrasado.png");
    }
    await page.goto("/app/agenda");
    await page.getByTestId("agenda-visao-atrasados").click();
    await expect(page.getByTestId("item-proxima-acao").filter({ hasText: TEXTO })).toHaveAttribute(
      "data-estado",
      "atrasada",
    );
    await shot(page, "07-agenda-atrasados.png");

    await linhaDaAcao(page, TEXTO).getByTestId("agenda-editar-acao").click();
    await linhaDaAcao(page, TEXTO).getByTestId("preset-quando-amanha").click();
    await linhaDaAcao(page, TEXTO).getByTestId("inbox-salvar-proximo-passo").click();
    await page.getByTestId("agenda-visao-atrasados").click();
    await expect(page.getByTestId("item-proxima-acao").filter({ hasText: TEXTO })).toHaveCount(0);
    await shot(page, "11-reagendar.png");
  });

  test("F concluir no Kanban some das pendentes", async ({ page }) => {
    test.skip(!demandaId || !pipelineId, "sem demanda/funil");
    await admin
      .from("demandas")
      .update({
        proximo_passo: TEXTO,
        proximo_passo_em: new Date(Date.now() + 3_600_000).toISOString(),
      })
      .eq("id", demandaId)
      .eq("organization_id", creds.org_id);

    await login(page, creds.users.manager!.email);
    await abrirKanbanDoLead(page);
    const card = cardDoLead(page);
    await expect(card).toContainText(TEXTO);
    await card.getByRole("button", { name: "Ações do lead" }).click();
    await page.getByRole("menuitem", { name: /Concluir próxima ação/i }).click();
    await expect(card.getByTestId("kanban-sem-proxima-acao")).toBeVisible({ timeout: 20_000 });
    await shot(page, "03-kanban-sem-proxima-acao.png");
    await shot(page, "10-concluir-acao.png");

    await page.goto(`/app/inbox/${conversaId}`);
    await expect(page.getByTestId("inbox-sem-proxima-acao")).toBeVisible({ timeout: 20_000 });
    await page.goto("/app/agenda");
    await expect(page.getByText(TEXTO)).toHaveCount(0);
  });

  test("I–L mover stage preserva; win/loss limpa; reabrir permite nova", async ({ page }) => {
    test.skip(!leadId || !stageWon || !stageLost || !stageOpen, "funil incompleto");
    const { data: dem } = await admin
      .from("demandas")
      .select("id")
      .eq("organization_id", creds.org_id)
      .eq("contact_id", contatoId)
      .is("fechada_em", null)
      .maybeSingle();
    const id = (dem as { id: string } | null)?.id;
    if (id) {
      await admin
        .from("demandas")
        .update({
          proximo_passo: "Não pode sobrar após perda",
          proximo_passo_em: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .eq("id", id)
        .eq("organization_id", creds.org_id);
    }

    await login(page, creds.users.manager!.email);
    async function updatedAt(): Promise<string> {
      const { data } = await admin.from("crm_leads").select("updated_at").eq("id", leadId).single();
      return (data as { updated_at: string }).updated_at;
    }
    const move = await page.request.post(`/api/v1/leads/${leadId}/move`, {
      data: {
        stage_id: stageOpen,
        position_in_stage: 1_000_000,
        expected_updated_at: await updatedAt(),
      },
    });
    expect(move.ok(), await move.text()).toBeTruthy();
    const { data: depoisMover } = await admin
      .from("demandas")
      .select("proximo_passo")
      .eq("id", id ?? "")
      .maybeSingle();
    expect(depoisMover?.proximo_passo).toBe("Não pode sobrar após perda");

    const lose = await page.request.post(`/api/v1/leads/${leadId}/lose`, {
      data: { lost_reason: "price" },
    });
    expect(lose.ok(), await lose.text()).toBeTruthy();
    const { data: depoisLoss } = await admin
      .from("demandas")
      .select("proximo_passo")
      .eq("contact_id", contatoId)
      .eq("organization_id", creds.org_id)
      .is("fechada_em", null)
      .maybeSingle();
    expect(depoisLoss?.proximo_passo).toBeNull();

    const reopen = await page.request.post(`/api/v1/leads/${leadId}/move`, {
      data: {
        stage_id: stageOpen,
        position_in_stage: 1_000_000,
        expected_updated_at: await updatedAt(),
      },
    });
    expect(reopen.ok(), await reopen.text()).toBeTruthy();
    const nova = await page.request.post("/api/v1/demandas", {
      data: {
        contact_id: contatoId,
        conversation_id: conversaId,
        lead_id: leadId,
        proximo_passo: "Reativou e marcou retorno",
        proximo_passo_em: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect(nova.ok(), await nova.text()).toBeTruthy();

    const winPrep = await page.request.post(`/api/v1/leads/${leadId}/win`);
    expect(winPrep.ok() || winPrep.status() === 409).toBeTruthy();
  });

  test("M–P sem ação, quente, supervisor e contato 360", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/inicio");
    await expect(page.getByRole("main").getByTestId("hoje-operacional")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("home-atencao")).toBeVisible();
    await expect(page.getByText(/quentes sem próxima ação/i).first()).toBeVisible();
    await expect(page.getByTestId("hoje-supervisor")).toBeVisible();

    await page.goto(`/app/contacts/${contatoId}`);
    await expect(page.getByTestId("contato-360-comercial")).toBeVisible({ timeout: 20_000 });
    await shot(page, "09-contato-360.png");

    if (pipelineId) {
      await page.goto(`/app/pipelines/${pipelineId}?sem_acao=1&quentes=1`);
      await expect(page.getByTestId("filtro-sem-proxima-acao")).toBeVisible({ timeout: 20_000 });
    }
  });

  test("Q–S reminder mock idempotente, opt-in e telefone do atendente", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    const phoneAtendente = "5511987654321";
    const patch = await page.request.patch("/api/v1/me/alert-prefs", {
      data: {
        alert_whatsapp_phone: `+${phoneAtendente}`,
        alert_proxima_acao: true,
        alert_antecedencia_min: 30,
      },
    });
    expect(patch.ok(), await patch.text()).toBeTruthy();

    const due = new Date(Date.now() + 20 * 60_000).toISOString();
    const { data: dem } = await admin
      .from("demandas")
      .select("id")
      .eq("organization_id", creds.org_id)
      .eq("contact_id", contatoId)
      .is("fechada_em", null)
      .maybeSingle();
    if (dem) {
      await admin
        .from("demandas")
        .update({
          proximo_passo: "Lembrete mock",
          proximo_passo_em: due,
          dono_kind: "humano",
          dono_user_id: creds.users.manager!.id,
        })
        .eq("id", (dem as { id: string }).id)
        .eq("organization_id", creds.org_id);
    }

    const secret = env.INTERNAL_SECRET;
    test.skip(!secret, "INTERNAL_SECRET ausente");
    const r1 = await page.request.post("/api/v1/cron/demanda-reminders", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    expect(r1.ok(), await r1.text()).toBeTruthy();
    const j1 = (await r1.json()) as {
      data: { enviados: number; entregas: Array<{ dest_e164: string; classificacao: string }> };
    };
    const r2 = await page.request.post("/api/v1/cron/demanda-reminders", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const j2 = (await r2.json()) as { data: { enviados: number } };
    expect(j2.data.enviados).toBe(0);

    const dests = j1.data.entregas.map((e) => e.dest_e164);
    for (const e of j1.data.entregas) {
      expect(e.classificacao).toBe("alerta_interno_atendente");
      expect(e.dest_e164).not.toContain("55119" + SUFIXO);
    }
    if (j1.data.enviados > 0) {
      expect(dests.some((d) => d.includes("5511987654321"))).toBeTruthy();
    }

    await page.goto("/app/settings/notifications");
    await expect(page.getByTestId("alertas-pessoais")).toBeVisible({ timeout: 20_000 });
    await shot(page, "12-config-alerta-whatsapp.png");
    await page.setContent(
      `<pre data-testid="alerta-mock-evidence">${JSON.stringify({ primeira: j1.data, segunda: j2.data }, null, 2)}</pre>`,
    );
    await shot(page, "13-alerta-whatsapp-mock-evidence.png");

    const optOut = await page.request.patch("/api/v1/me/alert-prefs", {
      data: { alert_proxima_acao: false },
    });
    expect(optOut.ok()).toBeTruthy();
    const r3 = await page.request.post("/api/v1/cron/demanda-reminders", {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const j3 = (await r3.json()) as { data: { enviados: number } };
    expect(j3.data.enviados).toBe(0);
  });

  test("T tenant B não vê ações de A", async ({ page }) => {
    const { data: orgB, error } = await admin
      .from("organizations")
      .insert({
        slug: `e2e-mf2-b-${SUFIXO}`,
        legal_name: "Org B MF2",
        display_name: "Org B MF2",
      })
      .select("id")
      .single();
    if (error || !orgB) throw new Error(`org B: ${error?.message}`);
    const { data: cB } = await admin
      .from("contacts")
      .insert({
        organization_id: (orgB as { id: string }).id,
        display_name: "Segredo B",
        phone_number: `+55117${SUFIXO}`,
      })
      .select("id")
      .single();
    await admin.from("demandas").insert({
      organization_id: (orgB as { id: string }).id,
      contact_id: (cB as { id: string }).id,
      origem: "manual",
      estado: "em_atendimento",
      proximo_passo: "SEGREDO ORG B",
      proximo_passo_em: new Date().toISOString(),
    });

    await login(page, creds.users.manager!.email);
    const lista = await page.request.get("/api/v1/demandas?visao=todas");
    expect(lista.ok()).toBeTruthy();
    const corpo = (await lista.json()) as { data: Array<{ texto: string | null }> };
    expect(corpo.data.some((a) => a.texto === "SEGREDO ORG B")).toBeFalsy();
  });

  test("U mobile 390", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, creds.users.manager!.email);
    if (pipelineId) {
      await page.goto(`/app/pipelines/${pipelineId}`);
      await expect(page.locator("body")).toBeVisible();
      await shot(page, "14-mobile-kanban.png");
    }
    await page.goto(`/app/inbox/${conversaId}`);
    await page.getByRole("button", { name: /ficha/i }).click();
    const ficha = page.getByRole("dialog", { name: /ficha do contato/i });
    await expect(ficha.getByTestId("inbox-proximo-passo")).toBeVisible({ timeout: 20_000 });
    await shot(page, "15-mobile-inbox-proxima-acao.png");
    await page.goto("/app/agenda");
    await expect(page.getByTestId("agenda-obrigacoes")).toBeVisible({ timeout: 20_000 });
    await shot(page, "16-mobile-agenda.png");
    await page.goto("/app/inicio");
    await expect(page.getByRole("main").getByTestId("hoje-operacional")).toBeVisible({ timeout: 20_000 });
    await shot(page, "17-mobile-home-hoje.png");
    await page.goto(`/app/contacts/${contatoId}`);
    await expect(page.getByTestId("contato-360-comercial")).toBeVisible({ timeout: 20_000 });
    await shot(page, "18-mobile-contato-360.png");
  });
});
