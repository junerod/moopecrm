/**
 * Home operacional — primeira dobra responde o que precisa de atenção agora.
 * Sem QR. Sem WhatsApp real. Sem warehouse.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";
import type { SnapshotDaHome } from "@/lib/home/tipos";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const SHOTS = path.join(process.cwd(), "docs/home-dashboard/screenshots");
const SHOTS_FINAL = path.join(process.cwd(), "docs/home-dashboard/screenshots/final");

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
let conversaFilaId = "";
let conversaMinhaId = "";
let contatoAtrasadoId = "";
let contatoHojeId = "";
let contatoQuenteId = "";
let pipelineId = "";
let stageOpen = "";
const SUFIXO = String(Date.now()).slice(-8);
const TEXTO_ATRASADA = `Enviar proposta ${SUFIXO}`;
const TEXTO_HOJE = `Retornar documentação ${SUFIXO}`;
const TEXTO_HOJE_2 = `Confirmar retirada ${SUFIXO}`;
const NOME_QUENTE = `Quente ${SUFIXO}`;
const SEGREDO_B = `SEGREDO HOME B ${SUFIXO}`;

type ContaExtra = { email: string; userId: string; orgId: string; senha: string };

const SENHA_EXTRA = "HomeDash!2026#Qa";
const extras: ContaExtra[] = [];

async function login(page: Page, email: string, senha = creds.password): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(senha);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

async function shot(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, nome), fullPage: true });
}

async function shotFinal(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(SHOTS_FINAL, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_FINAL, nome), fullPage: true });
}

async function snapshot(page: Page, periodo = "7d"): Promise<SnapshotDaHome> {
  const res = await page.request.get(`/api/v1/home/snapshot?periodo=${periodo}`);
  expect(res.ok(), await res.text()).toBeTruthy();
  const corpo = (await res.json()) as { data: SnapshotDaHome };
  return corpo.data;
}

async function criarConta(prefixo: string, nome: string, setupCompleto: boolean): Promise<ContaExtra> {
  const email = `${prefixo}-${SUFIXO}@qa.local`;
  const { data: criado, error: errUser } = await admin.auth.admin.createUser({
    email,
    password: SENHA_EXTRA,
    email_confirm: true,
  });
  if (errUser || !criado.user) throw errUser ?? new Error("sem usuário extra");
  const settings = setupCompleto
    ? {
        perfil_do_negocio: { id: "comercial", version: "1.0", aplicado_em: new Date().toISOString() },
        ai_mode: "copilot",
      }
    : { llm: { provider: "anthropic" } };
  const { data: org, error: errOrg } = await admin
    .from("organizations")
    .insert({
      slug: `${prefixo}-${SUFIXO}`,
      display_name: nome,
      legal_name: nome,
      status: "active",
      created_by: criado.user.id,
      onboarded_at: new Date().toISOString(),
      settings,
    })
    .select("id")
    .single();
  if (errOrg || !org) throw errOrg ?? new Error("sem org extra");
  await admin.from("user_organizations").insert({
    organization_id: org.id,
    user_id: criado.user.id,
    role: "admin",
    accepted_at: new Date().toISOString(),
  });
  if (setupCompleto) {
    const { data: colega } = await admin.auth.admin.createUser({
      email: `${prefixo}-col-${SUFIXO}@qa.local`,
      password: SENHA_EXTRA,
      email_confirm: true,
    });
    if (colega?.user) {
      extras.push({
        email: colega.user.email!,
        userId: colega.user.id,
        orgId: org.id as string,
        senha: SENHA_EXTRA,
      });
      await admin.from("user_organizations").insert({
        organization_id: org.id,
        user_id: colega.user.id,
        role: "agent",
        accepted_at: new Date().toISOString(),
      });
    }
    await admin.from("channel_sessions").insert({
      organization_id: org.id,
      webhook_secret_encrypted: "e2e",
      provider: "waha",
      waha_session_name: `${prefixo}-${SUFIXO}`,
      status: "WORKING",
      phone_number: "+5511999990001",
    });
    const { data: agente } = await admin
      .from("ai_agents")
      .insert({
        organization_id: org.id,
        name: "Home QA",
        system_prompt: "teste",
      })
      .select("id")
      .single();
    if (agente) {
      await admin.from("ai_knowledge_sources").insert({
        organization_id: org.id,
        agent_id: (agente as { id: string }).id,
        name: "FAQ",
        source_type: "faq",
      });
    }
    await admin.from("followup_flow_pointers").insert({
      organization_id: org.id,
      name: "Automação home",
      status: "active",
    });
  }
  const conta = {
    email,
    userId: criado.user.id,
    orgId: org.id as string,
    senha: SENHA_EXTRA,
  };
  extras.push(conta);
  return conta;
}

async function apagarExtras(): Promise<void> {
  const orgs = [...new Set(extras.map((e) => e.orgId))];
  for (const orgId of orgs) {
    await admin.from("campaign_recipients").delete().eq("organization_id", orgId);
    await admin.from("campaigns").delete().eq("organization_id", orgId);
    await admin.from("demandas").delete().eq("organization_id", orgId);
    await admin.from("conversations").delete().eq("organization_id", orgId);
    await admin.from("crm_leads").delete().eq("organization_id", orgId);
    await admin.from("attendant_availability").delete().eq("organization_id", orgId);
    await admin.from("ai_knowledge_sources").delete().eq("organization_id", orgId);
    await admin.from("ai_agents").delete().eq("organization_id", orgId);
    await admin.from("followup_flow_pointers").delete().eq("organization_id", orgId);
    await admin.from("channel_sessions").delete().eq("organization_id", orgId);
    await admin.from("contacts").delete().eq("organization_id", orgId);
    await admin.from("user_organizations").delete().eq("organization_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
  }
  for (const extra of extras) {
    if (extra.userId === "00000000-0000-0000-0000-000000000000") continue;
    await admin.auth.admin.deleteUser(extra.userId);
  }
}

test.describe("Home dashboard operacional", () => {
  test.describe.configure({ timeout: 180_000, mode: "serial" });

  test.beforeAll(async () => {
    if (!fs.existsSync(CREDS_PATH)) {
      execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
    }
    creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
    const agentId = creds.users.agent!.id;
    const agora = new Date();

    const { data: sessao, error: erroSessao } = await admin
      .from("channel_sessions")
      .insert({
        organization_id: creds.org_id,
        webhook_secret_encrypted: "e2e",
        provider: "waha",
        waha_session_name: `e2e-home-${SUFIXO}`,
      })
      .select("id")
      .single();
    if (erroSessao || !sessao) throw new Error(`sessão: ${erroSessao?.message}`);
    sessaoId = sessao.id as string;

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

    async function contato(nome: string, tel: string) {
      const { data, error } = await admin
        .from("contacts")
        .insert({
          organization_id: creds.org_id,
          display_name: nome,
          phone_number: tel.slice(0, 15),
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`contato ${nome}: ${error?.message}`);
      return data.id as string;
    }

    contatoAtrasadoId = await contato(`Carlos ${SUFIXO}`, `+551191${SUFIXO}`);
    contatoHojeId = await contato(`Marina ${SUFIXO}`, `+551192${SUFIXO}`);
    const contatoHoje2 = await contato(`Paulo ${SUFIXO}`, `+551196${SUFIXO}`);
    contatoQuenteId = await contato(NOME_QUENTE, `+551193${SUFIXO}`);
    const contatoQuente2 = await contato(`Quente B ${SUFIXO}`, `+551197${SUFIXO}`);
    const contatoFila = await contato(`Fila ${SUFIXO}`, `+551194${SUFIXO}`);
    const contatoMinha = await contato(`Minha ${SUFIXO}`, `+551195${SUFIXO}`);

    const { data: fila } = await admin
      .from("conversations")
      .insert({
        organization_id: creds.org_id,
        contact_id: contatoFila,
        channel_session_id: sessaoId,
        status: "open",
        last_message_preview: "Fila home",
        last_message_at: agora.toISOString(),
        last_inbound_at: new Date(agora.getTime() - 18 * 60_000).toISOString(),
      })
      .select("id")
      .single();
    conversaFilaId = (fila as { id: string }).id;

    const { data: minha } = await admin
      .from("conversations")
      .insert({
        organization_id: creds.org_id,
        contact_id: contatoMinha,
        channel_session_id: sessaoId,
        status: "open",
        assigned_to_user_id: agentId,
        last_message_preview: "Minha home",
        last_message_at: agora.toISOString(),
        last_inbound_at: agora.toISOString(),
      })
      .select("id")
      .single();
    conversaMinhaId = (minha as { id: string }).id;

    let leadQuente = "";
    if (pipelineId && stageOpen) {
      const { data: lead } = await admin
        .from("crm_leads")
        .insert({
          organization_id: creds.org_id,
          contact_id: contatoQuenteId,
          pipeline_id: pipelineId,
          stage_id: stageOpen,
          title: NOME_QUENTE,
          value_cents: 210000,
          currency: "BRL",
          temperatura: "quente",
          owner_user_id: agentId,
          owner_kind: "user",
        })
        .select("id")
        .single();
      leadQuente = (lead as { id: string } | null)?.id ?? "";
      const { data: lead2 } = await admin
        .from("crm_leads")
        .insert({
          organization_id: creds.org_id,
          contact_id: contatoQuente2,
          pipeline_id: pipelineId,
          stage_id: stageOpen,
          title: `Quente B ${SUFIXO}`,
          value_cents: 190000,
          currency: "BRL",
          temperatura: "quente",
          owner_user_id: agentId,
          owner_kind: "user",
        })
        .select("id")
        .single();
      if (lead2) {
        await admin.from("demandas").insert({
          organization_id: creds.org_id,
          contact_id: contatoQuente2,
          lead_id: (lead2 as { id: string }).id,
          origem: "manual",
          dono_kind: "humano",
          dono_user_id: agentId,
        });
      }
    }

    await admin.from("demandas").insert([
      {
        organization_id: creds.org_id,
        contact_id: contatoAtrasadoId,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: agentId,
        proximo_passo: TEXTO_ATRASADA,
        proximo_passo_em: new Date(agora.getTime() - 26 * 60 * 60_000).toISOString(),
      },
      {
        organization_id: creds.org_id,
        contact_id: contatoHojeId,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: agentId,
        proximo_passo: TEXTO_HOJE,
        proximo_passo_em: new Date(agora.getTime() + 2 * 60 * 60_000).toISOString(),
      },
      {
        organization_id: creds.org_id,
        contact_id: contatoHoje2,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: agentId,
        proximo_passo: TEXTO_HOJE_2,
        proximo_passo_em: new Date(agora.getTime() + 5 * 60 * 60_000).toISOString(),
      },
      {
        organization_id: creds.org_id,
        contact_id: contatoQuenteId,
        lead_id: leadQuente || null,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: agentId,
      },
    ]);
  });

  test.afterAll(async () => {
    await apagarExtras();
  });

  test("A agent vê Home pessoal", async ({ page }) => {
    await login(page, creds.users.agent!.email);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("hoje-operacional")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("home-atencao")).toBeVisible();
    await expect(page.getByTestId("home-hoje")).toBeVisible();
    await expect(page.getByTestId("home-funil")).toBeVisible();
    await expect(page.getByTestId("hoje-supervisor")).toHaveCount(0);
    await expect(page.getByTestId("home-atendimento")).toHaveCount(0);
    await expect(page.getByTestId("home-periodo")).toHaveCount(0);
    const snap = await snapshot(page);
    expect(snap.papel).toBe("agent");
    expect(snap.team).toBeNull();
    expect(snap.commercial).toBeNull();
    expect(snap.campaigns).toBeNull();
    expect(snap.sources.team).toBe("omit");
    await shot(page, "01-home-agent-desktop.png");
    await shot(page, "16-home-agent-premium.png");
  });

  test("B manager vê Home + operação", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("hoje-operacional")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("hoje-supervisor")).toBeVisible();
    await expect(page.getByTestId("home-atendimento")).toBeVisible();
    await expect(page.getByTestId("home-periodo")).toBeVisible();
    await expect(page.getByTestId("home-kpis")).toBeVisible();
    const snap = await snapshot(page);
    expect(snap.papel).toBe("manager");
    expect(snap.team).not.toBeNull();
    expect(snap.commercial).not.toBeNull();
    await shot(page, "02-home-manager-desktop.png");
    await shot(page, "03-home-atencao.png");
    await shot(page, "04-home-hoje.png");
    await shot(page, "05-home-funil.png");
    await shot(page, "06-home-atendimento.png");
    await shot(page, "15-home-manager-premium.png");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/app/inicio");
    await expect(page.getByTestId("home-kpis")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Carregando início")).toHaveCount(0);
    await shotFinal(page, "02-manager-extremo-1440.png");
    await page.getByTestId("home-atencao").screenshot({
      path: path.join(SHOTS, "18-home-attention-detail.png"),
    });
    await page.getByTestId("home-funil").screenshot({
      path: path.join(SHOTS, "19-home-funnel-compact.png"),
    });
  });

  test("C D E ação atrasada, hoje e quente sem ação", async ({ page }) => {
    await login(page, creds.users.agent!.email);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("hoje-operacional")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(TEXTO_ATRASADA)).toBeVisible();
    await expect(page.getByTestId("home-hoje")).toContainText(/Retornar documentação|Confirmar retirada/i);
    const snap = await snapshot(page);
    expect(snap.personal.atrasadas).toBeGreaterThanOrEqual(1);
    expect(snap.personal.hoje).toBeGreaterThanOrEqual(1);
    expect(snap.personal.quentes_sem_acao).toBeGreaterThanOrEqual(1);
    await expect(page.getByTestId("home-chip-atrasadas")).toBeVisible();
    await expect(page.getByText(/quentes sem próxima ação/i).first()).toBeVisible();
    await expect(page.getByText(/retornos hoje/i)).toBeVisible();
  });

  test("F G fila e maior espera", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("home-chip-fila")).toBeVisible({ timeout: 30_000 });
    const snap = await snapshot(page);
    expect(snap.team?.fila).toBeGreaterThanOrEqual(1);
    expect(snap.team?.espera_mais_antiga_s).toBeGreaterThanOrEqual(60);
    await expect(page.getByTestId("home-chip-espera")).toBeVisible();
  });

  test("H funil aparece", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("home-funil")).toBeVisible({ timeout: 30_000 });
    const snap = await snapshot(page);
    expect(snap.funnel.length).toBeGreaterThan(0);
    await expect(page.getByTestId("home-funil")).not.toContainText("Gargalo crítico");
  });

  test("I click ação abre contexto", async ({ page }) => {
    await login(page, creds.users.agent!.email);
    await page.goto("/app/inicio");
    await expect(page.getByText(TEXTO_ATRASADA)).toBeVisible({ timeout: 30_000 });
    await page.getByText(TEXTO_ATRASADA).click();
    await expect(page).toHaveURL(/\/app\/(inbox|contacts|kanban)/);
  });

  test("J click fila abre Inbox/Fila", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("home-chip-fila")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("home-chip-fila").click();
    await expect(page).toHaveURL(/\/app\/inbox\?filter=unassigned/);
  });

  test("K período manager funciona", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("home-periodo-30d")).toBeVisible({ timeout: 30_000 });
    await shot(page, "09-home-periodo-7d.png");
    const antes = page.waitForResponse((r) => r.url().includes("/api/v1/home/snapshot?periodo=30d"));
    await page.getByTestId("home-periodo-30d").click();
    const res = await antes;
    expect(res.ok()).toBeTruthy();
    const snap = await snapshot(page, "30d");
    expect(snap.periodo).toBe("30d");
  });

  test("L setup incompleto vira faixa compacta", async ({ page }) => {
    const incompleta = await criarConta("home-inc", "Home Incompleta", false);
    await login(page, incompleta.email, incompleta.senha);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("checklist-primeiros-passos")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/configuração \d\/6 concluída/i)).toBeVisible();
    await expect(page.getByTestId("checklist-empresa")).toHaveAttribute("data-feito", /sim|nao/);
    await shot(page, "08-home-setup-incompleto.png");
  });

  test("M N setup completo some e empty state", async ({ page }) => {
    const completa = await criarConta("home-ok", "Home Completa", true);
    await login(page, completa.email, completa.senha);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("hoje-operacional")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("checklist-primeiros-passos")).toHaveCount(0);
    await expect(page.getByText(/tudo em dia/i)).toBeVisible();
    await expect(page.getByText(/agenda livre por enquanto/i)).toBeVisible();
    await shot(page, "07-home-empty-state.png");
    await shotFinal(page, "13-empty.png");
  });

  test("O tenant isolation", async ({ page }) => {
    const { data: orgB, error } = await admin
      .from("organizations")
      .insert({
        slug: `e2e-home-b-${SUFIXO}`,
        legal_name: "Org B Home",
        display_name: "Org B Home",
      })
      .select("id")
      .single();
    if (error || !orgB) throw new Error(`org B: ${error?.message}`);
    extras.push({
      email: `unused-b-${SUFIXO}@qa.local`,
      userId: "00000000-0000-0000-0000-000000000000",
      orgId: (orgB as { id: string }).id,
      senha: "",
    });
    const { data: contatoB } = await admin
      .from("contacts")
      .insert({
        organization_id: (orgB as { id: string }).id,
        display_name: "Segredo B",
        phone_number: `+55118${SUFIXO}`.slice(0, 15),
      })
      .select("id")
      .single();
    await admin.from("demandas").insert({
      organization_id: (orgB as { id: string }).id,
      contact_id: (contatoB as { id: string }).id,
      origem: "manual",
      dono_kind: "ia",
      proximo_passo: SEGREDO_B,
      proximo_passo_em: new Date().toISOString(),
    });
    await login(page, creds.users.manager!.email);
    const snap = await snapshot(page);
    expect(snap.personal.acoes.some((a) => a.texto === SEGREDO_B)).toBeFalsy();
  });

  test("P erro parcial não derruba Home", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.route("**/api/v1/home/snapshot**", async (route) => {
      const res = await route.fetch();
      const json = (await res.json()) as { data: SnapshotDaHome };
      json.data.sources.funnel = "error";
      json.data.funnel = [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(json),
      });
    });
    await page.goto("/app/inicio");
    await expect(page.getByTestId("hoje-operacional")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("home-hoje")).toBeVisible();
    await expect(page.getByText(/funil agora indisponível temporariamente/i)).toBeVisible();
    await expect(page.getByTestId("home-atencao")).toBeVisible();
    await shot(page, "10-home-partial-error.png");
    await page.unroute("**/api/v1/home/snapshot**");
  });

  test("Q mobile 390", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, creds.users.agent!.email);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("hoje-operacional")).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(() => {
      const el = document.querySelector("[data-testid=hoje-operacional]");
      if (!el) return true;
      return el.scrollWidth > el.clientWidth + 2;
    });
    expect(overflow).toBeFalsy();
    await shot(page, "11-home-agent-mobile.png");
    await shot(page, "13-home-atencao-mobile.png");
    await shot(page, "14-home-hoje-mobile.png");
    await page.context().clearCookies();
    await login(page, creds.users.manager!.email);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("hoje-supervisor")).toBeVisible({ timeout: 30_000 });
    await shot(page, "12-home-manager-mobile.png");
    await shot(page, "17-home-manager-premium-mobile.png");
  });

  test("R S T regressões Blocos 1–3 (fumaça)", async ({ page }) => {
    await login(page, creds.users.manager!.email);
    await page.goto("/app/inbox");
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/app/inicio");
    await expect(page.getByTestId("hoje-operacional")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/retornos hoje/i)).toBeVisible();
    await page.goto("/app/agenda");
    await expect(page.getByTestId("agenda-obrigacoes")).toBeVisible({ timeout: 20_000 });
    await page.goto("/app/metrics");
    await expect(page.getByTestId("desempenho-atendimento")).toBeVisible({ timeout: 20_000 });
    await page.goto("/app/radar");
    await expect(page.locator("body")).toBeVisible();
    await page.goto("/app/campanhas");
    await expect(page.getByRole("heading", { name: "Campanhas" })).toBeVisible({ timeout: 20_000 });
    if (pipelineId) {
      await page.goto(`/app/pipelines/${pipelineId}`);
      await expect(page.locator("body")).toBeVisible();
    }
    expect(conversaFilaId && conversaMinhaId).toBeTruthy();
  });
});

async function nomear(userId: string, nome: string): Promise<void> {
  await admin.auth.admin.updateUserById(userId, { user_metadata: { full_name: nome } });
}

test.describe("Home premium visual seed", () => {
  test.describe.configure({ timeout: 180_000, mode: "serial" });

  let visual: ContaExtra;
  let visualAgent: ContaExtra | undefined;

  test.beforeAll(async () => {
    visual = await criarConta("home-prem", "Atelier Norte", true);
    await nomear(visual.userId, "Rafael Costa");
    visualAgent = extras.find((e) => e.orgId === visual.orgId && e.userId !== visual.userId);
    if (visualAgent) await nomear(visualAgent.userId, "João Mendes");

    const { data: maria, error: errMaria } = await admin.auth.admin.createUser({
      email: `home-prem-maria-${SUFIXO}@qa.local`,
      password: SENHA_EXTRA,
      email_confirm: true,
      user_metadata: { full_name: "Maria Souza" },
    });
    const { data: carlos, error: errCarlos } = await admin.auth.admin.createUser({
      email: `home-prem-carlos-${SUFIXO}@qa.local`,
      password: SENHA_EXTRA,
      email_confirm: true,
      user_metadata: { full_name: "Carlos Lima" },
    });
    if (errMaria || errCarlos || !maria?.user || !carlos?.user) {
      throw new Error(`atendentes visuais: ${errMaria?.message ?? errCarlos?.message ?? "sem user"}`);
    }
    extras.push(
      { email: maria.user.email!, userId: maria.user.id, orgId: visual.orgId, senha: SENHA_EXTRA },
      { email: carlos.user.email!, userId: carlos.user.id, orgId: visual.orgId, senha: SENHA_EXTRA },
    );
    await admin.from("user_organizations").insert([
      {
        organization_id: visual.orgId,
        user_id: maria.user.id,
        role: "agent",
        accepted_at: new Date().toISOString(),
      },
      {
        organization_id: visual.orgId,
        user_id: carlos.user.id,
        role: "agent",
        accepted_at: new Date().toISOString(),
      },
    ]);

    const agora = new Date();
    const joaoId = visualAgent?.userId ?? visual.userId;
    await admin.from("attendant_availability").insert([
      {
        organization_id: visual.orgId,
        user_id: joaoId,
        is_available: true,
        capacity: 8,
        last_heartbeat_at: agora.toISOString(),
      },
      {
        organization_id: visual.orgId,
        user_id: maria.user.id,
        is_available: true,
        capacity: 8,
        last_heartbeat_at: agora.toISOString(),
      },
      {
        organization_id: visual.orgId,
        user_id: carlos.user.id,
        is_available: false,
        capacity: 8,
        last_heartbeat_at: agora.toISOString(),
      },
    ]);

    const { data: funil } = await admin
      .from("crm_pipelines")
      .select("id")
      .eq("organization_id", visual.orgId)
      .eq("is_default", true)
      .maybeSingle();
    if (!funil) throw new Error("funil visual");
    const pipelineIdVisual = (funil as { id: string }).id;
    await admin.from("crm_pipelines").update({ name: "Vendas" }).eq("id", pipelineIdVisual);

    const { data: stages } = await admin
      .from("crm_stages")
      .select("id, is_won, is_lost, position")
      .eq("pipeline_id", pipelineIdVisual)
      .eq("is_archived", false)
      .order("position");
    const abertas = (stages ?? []).filter((s) => !s.is_won && !s.is_lost);
    const won = (stages ?? []).find((s) => s.is_won);
    const lost = (stages ?? []).find((s) => s.is_lost);
    const nomes = ["Novo", "Qualificação", "Proposta", "Negociação"];
    const etapas: string[] = [];
    for (let i = 0; i < 4 && i < abertas.length; i++) {
      await admin.from("crm_stages").update({ name: nomes[i] }).eq("id", abertas[i]!.id);
      etapas.push(abertas[i]!.id);
    }
    if (etapas.length < 4 || !won || !lost) throw new Error("etapas visuais");

    const { data: sessao } = await admin
      .from("channel_sessions")
      .select("id")
      .eq("organization_id", visual.orgId)
      .limit(1)
      .maybeSingle();
    const sessaoVisual = (sessao as { id: string } | null)?.id;
    if (!sessaoVisual) throw new Error("sessão visual");

    async function contato(nome: string, n: number): Promise<string> {
      const { data, error } = await admin
        .from("contacts")
        .insert({
          organization_id: visual.orgId,
          display_name: nome,
          phone_number: `+55${SUFIXO}${String(n).padStart(3, "0")}`,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`contato visual: ${error?.message}`);
      return (data as { id: string }).id;
    }

    const volumes = [
      { etapa: etapas[0]!, n: 8, valor: 600_000 },
      { etapa: etapas[1]!, n: 5, valor: 620_000 },
      { etapa: etapas[2]!, n: 4, valor: 550_000 },
      { etapa: etapas[3]!, n: 3, valor: 566_000 },
    ];
    let seq = 0;
    const idsContato: string[] = [];
    for (const bloco of volumes) {
      for (let i = 0; i < bloco.n; i++) {
        seq += 1;
        const cid = await contato(`Lead ${nomes[volumes.indexOf(bloco)]} ${seq}`, seq);
        idsContato.push(cid);
        await admin.from("crm_leads").insert({
          organization_id: visual.orgId,
          contact_id: cid,
          pipeline_id: pipelineIdVisual,
          stage_id: bloco.etapa,
          title: `Oportunidade ${seq}`,
          value_cents: bloco.valor,
          currency: "BRL",
          status: "open",
          created_at: new Date(
            agora.getTime() - (seq <= 6 ? (seq + 1) * 3600_000 : (10 + (seq % 6)) * 86400_000),
          ).toISOString(),
        });
      }
    }

    for (let i = 0; i < 4; i++) {
      seq += 1;
      const cid = await contato(`Ganho ${i + 1}`, seq);
      await admin.from("crm_leads").insert({
        organization_id: visual.orgId,
        contact_id: cid,
        pipeline_id: pipelineIdVisual,
        stage_id: won.id,
        title: `Ganho ${i + 1}`,
        value_cents: 280000,
        currency: "BRL",
        status: "won",
        closed_at: new Date(agora.getTime() - (i + 1) * 86400_000).toISOString(),
        created_at: new Date(agora.getTime() - (i + 2) * 86400_000).toISOString(),
      });
    }
    for (let i = 0; i < 8; i++) {
      seq += 1;
      const cid = await contato(`Perdido ${i + 1}`, seq);
      await admin.from("crm_leads").insert({
        organization_id: visual.orgId,
        contact_id: cid,
        pipeline_id: pipelineIdVisual,
        stage_id: lost.id,
        title: `Perdido ${i + 1}`,
        status: "lost",
        lost_reason: "preco",
        closed_at: new Date(agora.getTime() - (i + 1) * 86400_000).toISOString(),
        created_at: new Date(agora.getTime() - (i + 3) * 86400_000).toISOString(),
      });
    }
    for (let i = 0; i < 14; i++) {
      seq += 1;
      const cid = await contato(`Anterior ${i + 1}`, seq);
      await admin.from("crm_leads").insert({
        organization_id: visual.orgId,
        contact_id: cid,
        pipeline_id: pipelineIdVisual,
        title: `Anterior ${i + 1}`,
        stage_id: i < 3 ? won.id : i < 12 ? lost.id : etapas[0]!,
        status: i < 3 ? "won" : i < 12 ? "lost" : "open",
        lost_reason: i < 3 ? null : i < 12 ? "preco" : null,
        closed_at:
          i < 12
            ? new Date(agora.getTime() - (8 + (i % 5)) * 86400_000).toISOString()
            : null,
        created_at: new Date(agora.getTime() - (9 + (i % 5)) * 86400_000).toISOString(),
      });
    }

    const esperaMin = [8, 12, 15, 18, 22];
    for (let i = 0; i < 5; i++) {
      const cid = await contato(`Fila ${i + 1}`, 80 + i);
      await admin.from("conversations").insert({
        organization_id: visual.orgId,
        contact_id: cid,
        channel_session_id: sessaoVisual,
        status: "open",
        last_message_preview: "Aguardando",
        last_message_at: agora.toISOString(),
        last_inbound_at: new Date(agora.getTime() - esperaMin[i]! * 60_000).toISOString(),
      });
    }
    for (let i = 0; i < 4; i++) {
      const cid = await contato(`João conv ${i + 1}`, 90 + i);
      await admin.from("conversations").insert({
        organization_id: visual.orgId,
        contact_id: cid,
        channel_session_id: sessaoVisual,
        status: "open",
        assigned_to_user_id: joaoId,
        last_message_preview: "Com João",
        last_message_at: agora.toISOString(),
        last_inbound_at: agora.toISOString(),
      });
    }
    for (let i = 0; i < 2; i++) {
      const cid = await contato(`Maria conv ${i + 1}`, 96 + i);
      await admin.from("conversations").insert({
        organization_id: visual.orgId,
        contact_id: cid,
        channel_session_id: sessaoVisual,
        status: "open",
        assigned_to_user_id: maria.user.id,
        last_message_preview: "Com Maria",
        last_message_at: agora.toISOString(),
        last_inbound_at: agora.toISOString(),
      });
    }

    const cAtrasada1 = await contato("Carlos Mendes", 70);
    const cAtrasada2 = await contato("Helena Dias", 71);
    const cHoje1 = await contato("Ana Souza", 72);
    const cHoje2 = await contato("João Ferreira", 73);
    const cHoje3 = await contato("Luísa Prado", 74);
    const quentes = [await contato("Quente A", 75), await contato("Quente B", 76), await contato("Quente C", 77)];
    const leadsQuentes: string[] = [];
    for (const [i, cid] of quentes.entries()) {
      const { data: lead } = await admin
        .from("crm_leads")
        .insert({
          organization_id: visual.orgId,
          contact_id: cid,
          pipeline_id: pipelineIdVisual,
          stage_id: etapas[1]!,
          title: `Quente ${i + 1}`,
          value_cents: 190000,
          currency: "BRL",
          temperatura: "quente",
          status: "open",
          created_at: new Date(agora.getTime() - 10 * 86400_000).toISOString(),
        })
        .select("id")
        .single();
      if (lead) leadsQuentes.push((lead as { id: string }).id);
    }

    await admin.from("demandas").insert([
      {
        organization_id: visual.orgId,
        contact_id: cAtrasada1,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: visual.userId,
        proximo_passo: "Enviar proposta",
        proximo_passo_em: new Date(agora.getTime() - 2.2 * 3600_000).toISOString(),
      },
      {
        organization_id: visual.orgId,
        contact_id: cAtrasada2,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: visual.userId,
        proximo_passo: "Cobrar retorno",
        proximo_passo_em: new Date(agora.getTime() - 80 * 60_000).toISOString(),
      },
      {
        organization_id: visual.orgId,
        contact_id: cHoje1,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: visual.userId,
        proximo_passo: "Confirmar documentos",
        proximo_passo_em: new Date(agora.getTime() + 1 * 3600_000).toISOString(),
      },
      {
        organization_id: visual.orgId,
        contact_id: cHoje2,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: visual.userId,
        proximo_passo: "Retornar negociação",
        proximo_passo_em: new Date(agora.getTime() + 3 * 3600_000).toISOString(),
      },
      {
        organization_id: visual.orgId,
        contact_id: cHoje3,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: visual.userId,
        proximo_passo: "Enviar contrato",
        proximo_passo_em: new Date(agora.getTime() + 5 * 3600_000).toISOString(),
      },
      ...quentes.map((cid, i) => ({
        organization_id: visual.orgId,
        contact_id: cid,
        lead_id: leadsQuentes[i] ?? null,
        origem: "manual" as const,
        dono_kind: "humano" as const,
        dono_user_id: visual.userId,
      })),
    ]);

    if (visualAgent) {
      await admin.from("demandas").insert({
        organization_id: visual.orgId,
        contact_id: cHoje1,
        origem: "manual",
        dono_kind: "humano",
        dono_user_id: visualAgent.userId,
        proximo_passo: "Confirmar documentos",
        proximo_passo_em: new Date(agora.getTime() + 1 * 3600_000).toISOString(),
      });
    }

    const { data: camp } = await admin
      .from("campaigns")
      .insert({
        organization_id: visual.orgId,
        name: "Reativação Setembro",
        body_text: "Voltamos a falar",
        status: "completed",
        started_at: new Date(agora.getTime() - 2 * 86400_000).toISOString(),
      })
      .select("id")
      .single();
    if (camp) {
      const recs = idsContato.slice(0, 20).map((cid, i) => ({
        organization_id: visual.orgId,
        campaign_id: (camp as { id: string }).id,
        contact_id: cid,
        status: i < 2 ? "replied" : i === 2 ? "skipped" : "sent",
      }));
      if (recs.length) await admin.from("campaign_recipients").insert(recs);
    }
  });

  test.afterAll(async () => {
    await apagarExtras();
  });

  test("seed manager normal e recortes", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, visual.email, visual.senha);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("home-kpis")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("home-atencao")).toBeVisible();
    await expect(page.getByLabel("Carregando início")).toHaveCount(0);
    await page.getByText(/Prioridades/i).waitFor();
    await shotFinal(page, "01-manager-normal-1440.png");
    await page.getByTestId("home-atencao").screenshot({
      path: path.join(SHOTS_FINAL, "04-prioridades.png"),
    });
    await page.getByTestId("home-kpis").screenshot({ path: path.join(SHOTS_FINAL, "05-kpis.png") });
    await page.getByTestId("home-funil").screenshot({
      path: path.join(SHOTS_FINAL, "06-pipeline.png"),
    });
    await page.getByTestId("home-hoje").screenshot({
      path: path.join(SHOTS_FINAL, "07-hoje-timeline.png"),
    });
    await page.getByTestId("home-atendimento").screenshot({
      path: path.join(SHOTS_FINAL, "08-atendimento.png"),
    });
    await page.getByTestId("home-pulso").screenshot({
      path: path.join(SHOTS_FINAL, "09-pulso-comercial.png"),
    });
    await page.getByTestId("home-equipe").screenshot({
      path: path.join(SHOTS_FINAL, "10-equipe.png"),
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/inicio");
    await expect(page.getByTestId("home-kpis")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Carregando início")).toHaveCount(0);
    await shotFinal(page, "11-manager-mobile.png");
  });

  test("seed agent desktop e mobile", async ({ page }) => {
    test.skip(!visualAgent, "sem agent no seed");
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, visualAgent!.email, visualAgent!.senha);
    await page.goto("/app/inicio");
    await expect(page.getByTestId("home-atencao")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Carregando início")).toHaveCount(0);
    await expect(page.getByTestId("hoje-supervisor")).toHaveCount(0);
    await shotFinal(page, "03-agent-1440.png");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app/inicio");
    await expect(page.getByTestId("home-atencao")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Carregando início")).toHaveCount(0);
    await shotFinal(page, "12-agent-mobile.png");
  });
});
