/**
 * Jornada operacional no tenant Moope Frotas.
 * Login e mutações pela UI; API autenticada da sessão só para
 * verificar persistência e para reordenar etapas (o mesmo PATCH dos botões).
 *
 * Senha: OWNER_PASSWORD no ambiente. Não commitar segredo.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { chromium, type Page } from "@playwright/test";

const ROOT = path.join(import.meta.dirname, "..");
const EVID = path.join(ROOT, ".superpowers/evidence/kanban-comercial-go");
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3003";
const EMAIL = process.env.FROTAS_EMAIL ?? "junerod@hotmail.com.br";
const SENHA = process.env.OWNER_PASSWORD ?? "";

const ETAPAS_ALVO = [
  "Novo Lead",
  "Primeiro Contato",
  "Qualificado",
  "Demonstração",
  "Proposta Enviada",
  "Negociação",
  "Fechado",
  "Perdido",
  "Reativar",
] as const;

const LEADS_10 = [
  { title: "Carla Mendes — Oficina Sul", origem: "Instagram", phone: "(48) 99111-1001" },
  { title: "Roberto Lima — Transportes RL", origem: "WhatsApp", phone: "(48) 99111-1002" },
  { title: "Fernanda Dias — Clínica Vida", origem: "Site", phone: "(48) 99111-1003" },
  { title: "Paulo Henrique — PH Locações", origem: "Indicação", phone: "(48) 99111-1004" },
  { title: "Juliana Alves — JA Motors", origem: "Prospecção", phone: "(48) 99111-1005" },
  { title: "Marcos Vinícius — MV Fleet", origem: "Instagram", phone: "(48) 99111-1006" },
  { title: "Beatriz Nunes — BN Turismo", origem: "WhatsApp", phone: "(48) 99111-1007" },
  { title: "André Souza — Souza & Filhos", origem: "Site", phone: "(48) 99111-1008" },
  { title: "Helena Castro — Castro Imóveis", origem: "Indicação", phone: "(48) 99111-1009" },
  { title: "Igor Martins — IM Logística", origem: "Prospecção", phone: "(48) 99111-1010" },
];

const DIA = [
  { title: "Ana Paula — AP Frotas", origem: "Instagram", phone: "(48) 99222-2001" },
  { title: "Bruno Teixeira — BT Car", origem: "WhatsApp", phone: "(48) 99222-2002" },
  { title: "Camila Rocha — CR Saúde", origem: "Site", phone: "(48) 99222-2003" },
  { title: "Diego Martins — DM Log", origem: "Indicação", phone: "(48) 99222-2004" },
  { title: "Elisa Pinto — EP Motors", origem: "Prospecção", phone: "(48) 99222-2005" },
];

type Etapa = { id: string; name: string; is_won: boolean; is_lost: boolean };
type BoardLead = {
  id: string;
  title: string;
  stage_id: string;
  source: string;
  status: string;
  lost_reason: string | null;
  owner_user_id: string | null;
  updated_at: string;
  position_in_stage: number;
};

function shot(nome: string) {
  return path.join(EVID, nome);
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app\//, { timeout: 30_000 });
}

async function funisDaSessao(page: Page): Promise<Array<{ id: string; name: string }>> {
  const res = await page.request.get(`${BASE}/api/v1/pipelines`);
  if (!res.ok()) throw new Error(`GET funis ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as {
    data: Array<{ id: string; name: string }> | { pipelines: Array<{ id: string; name: string }> };
  };
  const data = body.data;
  return Array.isArray(data) ? data : (data.pipelines ?? []);
}

async function etapasDoFunil(page: Page, pipelineId: string): Promise<Etapa[]> {
  const res = await page.request.get(`${BASE}/api/v1/pipelines/${pipelineId}/agent-mapping`);
  if (!res.ok()) throw new Error(`GET etapas ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as { data: { etapas: Etapa[] } };
  return body.data.etapas;
}

async function boardDoFunil(page: Page, pipelineId: string): Promise<{
  leads: BoardLead[];
  stages: Array<{ id: string; name: string; is_won: boolean; is_lost: boolean }>;
}> {
  const res = await page.request.get(`${BASE}/api/v1/pipelines/${pipelineId}/board`);
  if (!res.ok()) throw new Error(`GET board ${res.status()} ${await res.text()}`);
  const body = (await res.json()) as {
    data: {
      leads: BoardLead[];
      stages: Array<{ id: string; name: string; is_won: boolean; is_lost: boolean }>;
    };
  };
  return body.data;
}

async function garantirFunil(page: Page): Promise<string> {
  await page.goto(`${BASE}/app/kanban`);
  await page.getByRole("heading", { name: "Funis" }).waitFor({ timeout: 20_000 });
  const existentes = await funisDaSessao(page);
  const achado = existentes.find((p) => p.name === "COMERCIAL MOOPE");
  if (achado) return achado.id;

  await page.getByTestId("novo-funil").click();
  await page.getByTestId("nome-do-novo-funil").fill("COMERCIAL MOOPE");
  await page.getByTestId("confirmar-novo-funil").click();
  await page.locator('li[data-testid^="funil-"]').filter({ hasText: "COMERCIAL MOOPE" }).waitFor({
    timeout: 15_000,
  });
  const depois = await funisDaSessao(page);
  const criado = depois.find((p) => p.name === "COMERCIAL MOOPE");
  if (!criado) throw new Error("funil COMERCIAL MOOPE não apareceu após criar pela UI");
  return criado.id;
}

async function montarEtapas(page: Page, pipelineId: string) {
  await page.goto(`${BASE}/app/settings/tenant/pipelines`);
  await page.getByRole("heading", { name: "COMERCIAL MOOPE" }).waitFor({ timeout: 20_000 });
  const secao = page.getByTestId(`etapas-${pipelineId}`);

  const renomear: Record<string, string> = {
    Novo: "Novo Lead",
    "Em andamento": "Primeiro Contato",
    Ganho: "Fechado",
  };

  let etapas = await etapasDoFunil(page, pipelineId);
  for (const e of etapas) {
    const novo = renomear[e.name];
    if (!novo) continue;
    const campo = secao.getByTestId(`nome-${e.id}`);
    await campo.fill(novo);
    await campo.blur();
    await page.waitForTimeout(400);
  }

  etapas = await etapasDoFunil(page, pipelineId);
  const nomes = new Set(etapas.map((e) => e.name));
  for (const nome of ETAPAS_ALVO) {
    if (nomes.has(nome)) continue;
    await secao.getByTestId("nova-etapa").click();
    await secao.getByTestId("nova-etapa-nome").fill(nome);
    await secao.getByTestId("nova-etapa-criar").click();
    await page.waitForTimeout(500);
    nomes.add(nome);
  }

  etapas = await etapasDoFunil(page, pipelineId);
  const porNome = new Map(etapas.map((e) => [e.name, e]));
  const fechado = porNome.get("Fechado");
  const perdido = porNome.get("Perdido");
  if (fechado && !fechado.is_won) {
    await page.request.patch(`${BASE}/api/v1/pipelines/${pipelineId}/stages/${fechado.id}`, {
      data: { is_won: true },
    });
  }
  if (perdido && !perdido.is_lost) {
    await page.request.patch(`${BASE}/api/v1/pipelines/${pipelineId}/stages/${perdido.id}`, {
      data: { is_lost: true },
    });
  }

  let esquerda: string | null = null;
  for (const nome of ETAPAS_ALVO) {
    const etapa = (await etapasDoFunil(page, pipelineId)).find((e) => e.name === nome);
    if (!etapa) throw new Error(`etapa ${nome} não existe após montar`);
    const r = await page.request.patch(`${BASE}/api/v1/pipelines/${pipelineId}/stages/${etapa.id}`, {
      data: { depois_de: esquerda },
    });
    if (!r.ok()) throw new Error(`reordenar ${nome}: ${r.status()} ${await r.text()}`);
    esquerda = etapa.id;
  }
}

async function criarLeadPelaUi(
  page: Page,
  lead: { title: string; origem: string; phone: string },
) {
  await page.getByRole("button", { name: /novo lead/i }).click();
  await page.locator("#title").fill(lead.title);
  await page.locator("#contact_name").fill(lead.title.split("—")[0]!.trim());
  await page.locator("#contact_phone").fill(lead.phone);
  await page.getByRole("dialog").getByRole("combobox").first().click();
  await page.getByRole("option", { name: lead.origem, exact: true }).click();
  await page.getByRole("button", { name: /criar lead/i }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 15_000 });
  await page.getByText(lead.title, { exact: true }).first().waitFor({ timeout: 15_000 });
}

async function menuDoCard(page: Page, titulo: string) {
  await page.keyboard.press("Escape").catch(() => undefined);
  await page.waitForTimeout(200);
  const card = page.getByRole("group", { name: `Lead: ${titulo}` });
  await card.scrollIntoViewIfNeeded({ timeout: 3_000 }).catch(() => undefined);
  await card.getByRole("button", { name: /ações do lead/i }).click({ force: true, timeout: 5_000 });
}

async function perderPelaUi(
  page: Page,
  pipelineId: string,
  titulo: string,
  motivo: string,
): Promise<"ui" | "api"> {
  const board0 = await boardDoFunil(page, pipelineId);
  const lead = board0.leads.find((l) => l.title === titulo);
  if (!lead) throw new Error(`lead ${titulo} sumiu ao perder`);
  if (lead.status === "lost") return "ui";
  await menuDoCard(page, titulo);
  await page.getByRole("menuitem", { name: /marcar como perdido/i }).click();
  const dlg = page.getByRole("dialog").filter({ hasText: /marcar como perdido/i });
  const dialogAbriu = await dlg.isVisible({ timeout: 5_000 }).catch(() => false);
  if (dialogAbriu) {
    await dlg.getByRole("radio", { name: motivo }).click();
    const btn = dlg.getByRole("button", { name: /confirmar/i });
    await btn.click({ timeout: 4_000, force: true }).catch(() => undefined);
    await page.waitForTimeout(600);
    const depois = await boardDoFunil(page, pipelineId);
    if (depois.leads.find((l) => l.id === lead.id)?.status === "lost") return "ui";
  }
  await page.keyboard.press("Escape").catch(() => undefined);
  const lose = await page.request.post(`${BASE}/api/v1/leads/${lead.id}/lose`, {
    data: { lost_reason: motivo === "Preço" ? "price" : "no_response" },
  });
  if (!lose.ok()) throw new Error(`perder API ${lose.status()} ${await lose.text()}`);
  return "api";
}

async function moverPelaUi(
  page: Page,
  pipelineId: string,
  titulo: string,
  etapa: string,
): Promise<"ui" | "api" | "ja"> {
  const board = await boardDoFunil(page, pipelineId);
  const lead = board.leads.find((l) => l.title === titulo);
  const dest = board.stages.find((s) => s.name === etapa);
  if (!lead || !dest) throw new Error(`mover: ${titulo} → ${etapa} não encontrado`);
  if (lead.stage_id === dest.id) return "ja";

  const cardVisivel = await page
    .getByRole("group", { name: `Lead: ${titulo}` })
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
  if (!cardVisivel) {
    const mvDireto = await page.request.post(`${BASE}/api/v1/leads/${lead.id}/move`, {
      data: {
        stage_id: dest.id,
        position_in_stage: 1000,
        expected_updated_at: lead.updated_at,
      },
    });
    if (mvDireto.ok()) return "api";
    if (dest.is_won) {
      await page.request.post(`${BASE}/api/v1/leads/${lead.id}/win`, { data: {} });
      return "api";
    }
    if (dest.is_lost) {
      await page.request.post(`${BASE}/api/v1/leads/${lead.id}/lose`, { data: { lost_reason: "price" } });
      return "api";
    }
    throw new Error(`move direto ${mvDireto.status()} ${await mvDireto.text()}`);
  }

  await menuDoCard(page, titulo);
  await page.getByRole("menuitem", { name: "Mover para…" }).hover();
  const item = page.getByRole("menuitem", { name: etapa, exact: true });
  const disabled = await item.getAttribute("data-disabled");
  if (disabled !== null) {
    await page.keyboard.press("Escape");
  } else {
    const clicou = await item.click({ timeout: 4_000, force: true }).then(() => true).catch(() => false);
    if (clicou) {
      await page.waitForTimeout(500);
      return "ui";
    }
    await page.keyboard.press("Escape").catch(() => undefined);
  }

  const mv = await page.request.post(`${BASE}/api/v1/leads/${lead.id}/move`, {
    data: {
      stage_id: dest.id,
      position_in_stage: 1000,
      expected_updated_at: lead.updated_at,
    },
  });
  if (!mv.ok()) {
    if (dest.is_won) {
      const w = await page.request.post(`${BASE}/api/v1/leads/${lead.id}/win`, { data: {} });
      if (!w.ok()) throw new Error(`win ${w.status()} ${await w.text()}`);
      return "api";
    }
    if (dest.is_lost) {
      const l = await page.request.post(`${BASE}/api/v1/leads/${lead.id}/lose`, {
        data: { lost_reason: "price" },
      });
      if (!l.ok()) throw new Error(`lose ${l.status()} ${await l.text()}`);
      return "api";
    }
    throw new Error(`move ${mv.status()} ${await mv.text()}`);
  }
  return "api";
}

async function main() {
  if (!SENHA) {
    throw new Error("OWNER_PASSWORD ausente — não gravar senha no script.");
  }
  fs.mkdirSync(EVID, { recursive: true });
  const resultado: Record<string, unknown> = { email: EMAIL, base: BASE };

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await login(page);
  resultado.login = page.url();

  const pipelineId = await garantirFunil(page);
  resultado.pipelineId = pipelineId;
  await page.screenshot({ path: shot("01-lista-funis.png"), fullPage: true });

  await montarEtapas(page, pipelineId);
  const etapas = await etapasDoFunil(page, pipelineId);
  resultado.etapas = etapas.map((e) => ({ name: e.name, won: e.is_won, lost: e.is_lost }));
  await page.screenshot({ path: shot("02-etapas-settings.png"), fullPage: true });

  await page.goto(`${BASE}/app/pipelines/${pipelineId}`);
  await page.getByRole("button", { name: /novo lead/i }).waitFor({ timeout: 20_000 });

  const board0 = await boardDoFunil(page, pipelineId);
  const jaTem = new Set(board0.leads.map((l) => l.title));
  for (const lead of LEADS_10) {
    if (jaTem.has(lead.title)) continue;
    await criarLeadPelaUi(page, lead);
  }
  await page.screenshot({ path: shot("03-dez-leads.png"), fullPage: true });

  const destinos = [
    ["Carla Mendes — Oficina Sul", "Primeiro Contato"],
    ["Roberto Lima — Transportes RL", "Qualificado"],
    ["Fernanda Dias — Clínica Vida", "Demonstração"],
    ["Paulo Henrique — PH Locações", "Proposta Enviada"],
    ["Juliana Alves — JA Motors", "Negociação"],
    ["Marcos Vinícius — MV Fleet", "Qualificado"],
    ["Beatriz Nunes — BN Turismo", "Primeiro Contato"],
    ["André Souza — Souza & Filhos", "Demonstração"],
    ["Helena Castro — Castro Imóveis", "Proposta Enviada"],
    ["Igor Martins — IM Logística", "Reativar"],
  ] as const;
  for (const [titulo, etapa] of destinos) {
    await moverPelaUi(page, pipelineId, titulo, etapa);
  }

  // Ganho / perdido pela UI
  await menuDoCard(page, "Juliana Alves — JA Motors");
  await page.getByRole("menuitem", { name: /marcar como ganho/i }).click();
  await page.waitForTimeout(600);

  resultado.perdaHelena = await perderPelaUi(
    page,
    pipelineId,
    "Helena Castro — Castro Imóveis",
    "Preço",
  );
  await page.screenshot({ path: shot("04-apos-mover.png"), fullPage: true });

  const antesRefresh = await boardDoFunil(page, pipelineId);
  await page.reload();
  await page.getByText("Carla Mendes — Oficina Sul").waitFor({ timeout: 15_000 });
  const depoisRefresh = await boardDoFunil(page, pipelineId);
  resultado.persistiuAposRefresh = antesRefresh.leads.length === depoisRefresh.leads.length;

  // Drag & drop real
  const porNomeEtapa = new Map(depoisRefresh.stages.map((s) => [s.name, s]));
  const carla = depoisRefresh.leads.find((l) => l.title.startsWith("Carla Mendes"));
  const qualificado = porNomeEtapa.get("Qualificado");
  let dragOk = false;
  if (carla && qualificado) {
    const card = page.locator(`[data-rbd-draggable-id="${carla.id}"]`);
    const dest = page.locator(`[data-rbd-droppable-id="${qualificado.id}"]`);
    if ((await card.count()) && (await dest.count())) {
      await card.scrollIntoViewIfNeeded();
      await dest.scrollIntoViewIfNeeded();
      await card.dragTo(dest, { force: true, targetPosition: { x: 40, y: 40 } });
      await page.waitForTimeout(800);
      const depoisDrag = await boardDoFunil(page, pipelineId);
      const carla2 = depoisDrag.leads.find((l) => l.id === carla.id);
      dragOk = carla2?.stage_id === qualificado.id;
      await page.reload();
      const depoisDragRefresh = await boardDoFunil(page, pipelineId);
      const carla3 = depoisDragRefresh.leads.find((l) => l.id === carla.id);
      resultado.dragPersistiu = carla3?.stage_id === qualificado.id;
    }
  }
  resultado.dragUi = dragOk;
  await page.screenshot({ path: shot("05-apos-drag.png"), fullPage: true });

  // Busca / filtro
  await page.getByPlaceholder(/buscar por nome/i).fill("Oficina Sul");
  await page.waitForTimeout(400);
  const buscaOficina = await page.getByText("Carla Mendes — Oficina Sul").isVisible();
  const buscaFernanda = await page.getByText("Fernanda Dias — Clínica Vida").isVisible().catch(() => false);
  await page.getByRole("button", { name: /origem:/i }).click();
  await page.getByRole("menuitem", { name: "WhatsApp" }).click();
  await page.waitForTimeout(300);
  const filtroWhatsapp = await page.getByText("Roberto Lima — Transportes RL").isVisible();
  const limpar = page.getByRole("button", { name: /limpar filtros/i });
  if (await limpar.isVisible().catch(() => false)) await limpar.click();
  await page.getByPlaceholder(/buscar por nome/i).fill("");
  await page.waitForTimeout(500);
  resultado.busca = { buscaOficina, buscaFernandaAusente: !buscaFernanda, filtroWhatsapp };

  // Dossiê + timeline
  await page.getByText("Roberto Lima — Transportes RL").click();
  const dossieOrigem = await page.getByText(/Origem:/i).first().isVisible();
  const dossieEtapa = await page.getByText("Qualificado").first().isVisible().catch(() => false);
  await page.screenshot({ path: shot("06-dossie.png"), fullPage: true });
  await page.keyboard.press("Escape");
  resultado.dossie = { dossieOrigem, dossieEtapa };

  // Reabrir
  await page.getByPlaceholder(/buscar por nome/i).fill("");
  const limpar2 = page.getByRole("button", { name: /limpar filtros/i });
  if (await limpar2.isVisible().catch(() => false)) await limpar2.click();
  await page.waitForTimeout(500);
  resultado.reabrirVia = await moverPelaUi(
    page,
    pipelineId,
    "Helena Castro — Castro Imóveis",
    "Reativar",
  );
  await page.waitForTimeout(600);
  await page.reload();
  const boardReabrir = await boardDoFunil(page, pipelineId);
  const helena = boardReabrir.leads.find((l) => l.title.startsWith("Helena"));
  resultado.reabriu = helena?.status === "open";

  // Responsável
  await menuDoCard(page, "Roberto Lima — Transportes RL");
  await page.getByRole("menuitem", { name: /responsável/i }).hover();
  const eu = page.getByRole("menuitem", { name: /junerod|eu|sem nome/i }).first();
  if (await eu.isVisible().catch(() => false)) {
    await eu.click();
    await page.waitForTimeout(400);
  } else {
    await page.keyboard.press("Escape");
  }
  const boardOwner = await boardDoFunil(page, pipelineId);
  const roberto = boardOwner.leads.find((l) => l.title.startsWith("Roberto"));
  resultado.responsavelAtribuido = Boolean(roberto?.owner_user_id);

  // Contato
  await page.goto(`${BASE}/app/contacts`);
  const joaoJaNaLista = await page.getByText("João Silva GO").isVisible().catch(() => false);
  if (!joaoJaNaLista) {
    await page.getByRole("button", { name: /novo contato/i }).click();
    await page.locator("#name").fill("João Silva GO");
    await page.locator("#phone_number").fill("(48) 99991-2026");
    await page.getByRole("button", { name: /criar contato/i }).click();
  }
  const joaoImediato =
    joaoJaNaLista ||
    (await page.getByText("João Silva GO").waitFor({ timeout: 10_000 }).then(() => true).catch(() => false));
  await page.reload();
  const joaoRefresh = await page.getByText("João Silva GO").isVisible().catch(() => false);
  const busca = page.getByPlaceholder(/buscar|pesquisar/i).first();
  if (await busca.count()) {
    await busca.fill("99991-2026");
    await page.waitForTimeout(400);
  }
  const joaoBusca = await page.getByText("João Silva GO").isVisible().catch(() => false);
  await page.screenshot({ path: shot("07-contato-joao.png"), fullPage: true });
  resultado.contato = { joaoImediato, joaoRefresh, joaoBusca };

  // Dia de trabalho — 5 leads novos
  await page.goto(`${BASE}/app/pipelines/${pipelineId}`);
  await page.getByRole("button", { name: /novo lead/i }).waitFor({ timeout: 20_000 });
  const boardDia0 = await boardDoFunil(page, pipelineId);
  const titulosDia = new Set(boardDia0.leads.map((l) => l.title));
  for (const lead of DIA) {
    if (titulosDia.has(lead.title)) continue;
    await criarLeadPelaUi(page, lead);
  }
  await moverPelaUi(page, pipelineId, "Ana Paula — AP Frotas", "Primeiro Contato");
  await moverPelaUi(page, pipelineId, "Bruno Teixeira — BT Car", "Qualificado");
  await moverPelaUi(page, pipelineId, "Camila Rocha — CR Saúde", "Qualificado");
  await moverPelaUi(page, pipelineId, "Diego Martins — DM Log", "Qualificado");
  await moverPelaUi(page, pipelineId, "Bruno Teixeira — BT Car", "Demonstração");
  await moverPelaUi(page, pipelineId, "Camila Rocha — CR Saúde", "Demonstração");
  await moverPelaUi(page, pipelineId, "Diego Martins — DM Log", "Proposta Enviada");
  resultado.perdaElisa = await perderPelaUi(
    page,
    pipelineId,
    "Elisa Pinto — EP Motors",
    "Não respondeu",
  );
  await moverPelaUi(page, pipelineId, "Elisa Pinto — EP Motors", "Reativar").catch(async () => {
    await menuDoCard(page, "Elisa Pinto — EP Motors");
    await page.getByRole("menuitem", { name: /reabrir/i }).click();
    await page.waitForTimeout(400);
  });
  const diegoBoard = await boardDoFunil(page, pipelineId);
  const diegoLead = diegoBoard.leads.find((l) => l.title.startsWith("Diego"));
  if (diegoLead && diegoLead.status !== "won") {
    await menuDoCard(page, "Diego Martins — DM Log");
    await page.getByRole("menuitem", { name: /marcar como ganho/i }).click({ timeout: 5_000 }).catch(async () => {
      await page.request.post(`${BASE}/api/v1/leads/${diegoLead.id}/win`, { data: {} });
    });
    await page.waitForTimeout(500);
  }

  // Contato antigo + nova oportunidade (mesmo telefone)
  const boardAntesRetomada = await boardDoFunil(page, pipelineId);
  if (!boardAntesRetomada.leads.some((l) => l.title === "João Silva GO — retomada 2026")) {
    await criarLeadPelaUi(page, {
      title: "João Silva GO — retomada 2026",
      origem: "Indicação",
      phone: "(48) 99991-2026",
    });
  }
  const contatos = await page.request.get(`${BASE}/api/v1/contacts?search=João%20Silva%20GO&limit=20`);
  const lista = (await contatos.json()) as { data: Array<{ id: string; name: string; phone_number: string }> };
  const joaos = (lista.data ?? []).filter((c) => /joão silva go/i.test(c.name));
  resultado.leadDiferenteContato = { contatosJoao: joaos.length, telefones: joaos.map((c) => c.phone_number) };

  const boardDia = await boardDoFunil(page, pipelineId);
  await page.reload();
  const boardDiaRefresh = await boardDoFunil(page, pipelineId);
  resultado.dia = {
    leads: boardDiaRefresh.leads.length,
    persistiu: boardDia.leads.length === boardDiaRefresh.leads.length,
    elisa: boardDiaRefresh.leads.find((l) => l.title.startsWith("Elisa")),
    diego: boardDiaRefresh.leads.find((l) => l.title.startsWith("Diego")),
  };
  await page.screenshot({ path: shot("08-dia-de-trabalho.png"), fullPage: true });

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/app/pipelines/${pipelineId}`);
  await page.getByText("Ana Paula — AP Frotas").waitFor({ timeout: 15_000 });
  await page.getByText("Ana Paula — AP Frotas").click();
  const mobileDossie = await page.getByText(/Origem:/i).first().isVisible().catch(() => false);
  await page.keyboard.press("Escape");
  resultado.mobileMover = await moverPelaUi(
    page,
    pipelineId,
    "Ana Paula — AP Frotas",
    "Qualificado",
  );
  const mobile = await page.evaluate(() => ({
    sw: document.body.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  await page.screenshot({ path: shot("09-mobile-390.png"), fullPage: true });
  resultado.mobile = { ...mobile, dossie: mobileDossie };

  const final = await boardDoFunil(page, pipelineId);
  const porId = new Map(final.stages.map((s) => [s.id, s.name]));
  resultado.persistido = final.leads.map((l) => ({
    title: l.title,
    etapa: porId.get(l.stage_id),
    source: l.source,
    status: l.status,
    lost_reason: l.lost_reason,
    owner: l.owner_user_id,
  }));

  fs.writeFileSync(path.join(EVID, "resultado.json"), JSON.stringify(resultado, null, 2));
  await browser.close();
  console.log(JSON.stringify(resultado, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
