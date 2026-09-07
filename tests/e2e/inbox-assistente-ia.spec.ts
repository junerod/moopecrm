/**
 * CHECKPOINT 2.6 — Copilot no Inbox, pela tela.
 *
 * Prova o fluxo que a Etapa 2.5 prometeu e que unit test não alcança:
 *
 *   sugestão visível → Usar resposta preenche o composer (não envia) →
 *   atendente edita → envia → mensagem HUMAN → silêncio durável.
 *
 * Também: humano já no comando + nova inbound ainda mostra sugestão,
 * sem outbound de IA; e CONTROLLED confirma `move_lead_stage` uma vez.
 *
 * A geração LLM fica de fora deste arquivo de propósito: Playwright não
 * chama modelo. A sugestão é semeada como o worker gravaria. O job
 * `copilot_turn` e o dedup são do `test:db` + unitário.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const EVIDENCIA = path.join(process.cwd(), ".superpowers/evidence/inbox-assistente-ia");

interface Creds {
  password: string;
  org_id: string;
  users: Record<string, { id: string; email: string; role: string }>;
}

const env = carregarEnvLocal();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const pgUrl = env.SUPABASE_DB_URL;
if (!pgUrl) throw new Error("SUPABASE_DB_URL ausente no ambiente do E2E");
const banco = new pg.Pool({ connectionString: pgUrl, max: 2 });

let creds: Creds;
let conversaId = "";
let contatoId = "";
let sessaoId = "";
let inboundId = "";
let leadId = "";
let etapaDestinoId = "";
let pedidoId = "";
const NOME = `Assistente IA ${Date.now()}`;
const RASCUNHO = "Segue o valor do plano que combinamos. Posso mandar a proposta?";
const TEXTO_EDITADO = `${RASCUNHO} (revisado pelo atendente)`;

async function login(page: Page, email: string, senha: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(senha);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 60_000 });
}

async function captura(page: Page, nome: string): Promise<void> {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCIA, `${nome}.png`), fullPage: true });
}

async function silencioNoBanco(): Promise<string> {
  const { data, error } = await admin
    .from("conversations")
    .select("bot_silenced_until")
    .eq("id", conversaId)
    .maybeSingle();
  if (error) throw new Error(`silêncio: ${error.message}`);
  return (data as { bot_silenced_until: string | null } | null)?.bot_silenced_until ?? "(null)";
}

async function gravarAiMode(modo: "off" | "copilot" | "controlled" | "autonomous"): Promise<void> {
  const { data, error } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", creds.org_id)
    .single();
  if (error) throw new Error(`settings: ${error.message}`);
  const atual = (data as { settings: Record<string, unknown> | null }).settings ?? {};
  const { error: up } = await admin
    .from("organizations")
    .update({ settings: { ...atual, ai_mode: modo } })
    .eq("id", creds.org_id);
  if (up) throw new Error(`ai_mode: ${up.message}`);
}

test.describe("Inbox — Assistente IA", () => {
  test.describe.configure({ timeout: 180_000 });

  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeAll(async () => {
    if (!fs.existsSync(CREDS_PATH)) {
      execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
    }
    creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
    await gravarAiMode("copilot");

    const { data: sessaoExistente } = await admin
      .from("channel_sessions")
      .select("id")
      .eq("organization_id", creds.org_id)
      .limit(1)
      .maybeSingle();
    sessaoId = (sessaoExistente as { id: string } | null)?.id ?? "";
    if (!sessaoId) {
      const { data, error } = await admin
        .from("channel_sessions")
        .insert({
          organization_id: creds.org_id,
          waha_session_name: `e2e-assistente-${Date.now()}`,
          webhook_secret_encrypted: "e2e",
        })
        .select("id")
        .single();
      if (error) throw new Error(`channel_sessions: ${error.message}`);
      sessaoId = (data as { id: string }).id;
    }

    const { data: contato, error: erroContato } = await admin
      .from("contacts")
      .insert({
        organization_id: creds.org_id,
        display_name: NOME,
        phone_number: `+55119${String(Date.now()).slice(-8)}`,
      })
      .select("id")
      .single();
    if (erroContato) throw new Error(`contacts: ${erroContato.message}`);
    contatoId = (contato as { id: string }).id;

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
    if (erroConversa) throw new Error(`conversations: ${erroConversa.message}`);
    conversaId = (conversa as { id: string }).id;

    const { data: inbound, error: erroInbound } = await admin
      .from("messages")
      .insert({
        organization_id: creds.org_id,
        conversation_id: conversaId,
        channel_session_id: sessaoId,
        contact_id: contatoId,
        type: "text",
        direction: "inbound",
        body: "Quanto custa o plano para uns 25 veículos?",
      })
      .select("id")
      .single();
    if (erroInbound) throw new Error(`messages inbound: ${erroInbound.message}`);
    inboundId = (inbound as { id: string }).id;

    await banco.query(
      `insert into ai_copilot_suggestions (
         organization_id, conversation_id, contact_id, inbound_message_id,
         summary, intent, suggested_reply, suggested_next_action, extracted_fields,
         confidence, status, model
       ) values ($1,$2,$3,$4,$5,'PRICE',$6,'Enviar proposta','{"frota":"25"}',0.86,'ready','e2e-seed')`,
      [
        creds.org_id,
        conversaId,
        contatoId,
        inboundId,
        "Cliente perguntou preço para cerca de 25 veículos. Ainda não recebeu proposta.",
        RASCUNHO,
      ],
    );

    let { data: funil } = await admin
      .from("crm_pipelines")
      .select("id, crm_stages(id, position)")
      .eq("organization_id", creds.org_id)
      .eq("is_archived", false)
      .limit(1)
      .maybeSingle();
    if (!(funil as { id?: string } | null)?.id) {
      const { data: criado, error: erroFunil } = await admin
        .from("crm_pipelines")
        .insert({
          organization_id: creds.org_id,
          name: "Funil Assistente E2E",
          slug: `funil-assistente-${Date.now()}`,
        })
        .select("id")
        .single();
      if (erroFunil) throw new Error(`crm_pipelines: ${erroFunil.message}`);
      const funilNovo = criado as { id: string };
      const { error: erroEtapas } = await admin.from("crm_stages").insert([
        {
          organization_id: creds.org_id,
          pipeline_id: funilNovo.id,
          name: "Novo",
          slug: "novo",
          position: 1000,
        },
        {
          organization_id: creds.org_id,
          pipeline_id: funilNovo.id,
          name: "Proposta",
          slug: "proposta",
          position: 2000,
        },
      ]);
      if (erroEtapas) throw new Error(`crm_stages: ${erroEtapas.message}`);
      const { data: deNovo } = await admin
        .from("crm_pipelines")
        .select("id, crm_stages(id, position)")
        .eq("id", funilNovo.id)
        .single();
      funil = deNovo;
    }
    const funilId = (funil as { id: string }).id;
    const etapas = (funil as { crm_stages?: Array<{ id: string; position: number }> }).crm_stages;
    if (!etapas?.length) throw new Error("a org de teste não tem funil com etapa");
    const ordenadas = [...etapas].sort((a, b) => a.position - b.position);
    const etapaOrigem = ordenadas[0]!;
    let etapaDestino = ordenadas[1];
    if (!etapaDestino) {
      const { data: extra, error: erroEtapa } = await admin
        .from("crm_stages")
        .insert({
          organization_id: creds.org_id,
          pipeline_id: funilId,
          name: "Proposta E2E",
          slug: `proposta-e2e-${Date.now()}`,
          position: etapaOrigem.position + 1000,
        })
        .select("id")
        .single();
      if (erroEtapa) throw new Error(`crm_stages: ${erroEtapa.message}`);
      etapaDestino = extra as { id: string; position: number };
    }
    etapaDestinoId = etapaDestino.id;

    const { data: lead, error: erroLead } = await admin
      .from("crm_leads")
      .insert({
        organization_id: creds.org_id,
        contact_id: contatoId,
        pipeline_id: funilId,
        stage_id: etapaOrigem.id,
        title: `Negócio de ${NOME}`,
      })
      .select("id")
      .single();
    if (erroLead) throw new Error(`crm_leads: ${erroLead.message}`);
    leadId = (lead as { id: string }).id;

    const pedido = await banco.query<{ id: string }>(
      `insert into ai_action_requests (
         organization_id, conversation_id, contact_id, lead_id,
         requested_action, payload, policy_result, status, idempotency_key
       ) values ($1,$2,$3,$4,'move_lead_stage',$5,'REQUIRE_CONFIRMATION','pending',$6)
       returning id`,
      [
        creds.org_id,
        conversaId,
        contatoId,
        leadId,
        JSON.stringify({ lead_id: leadId, stage_id: etapaDestinoId }),
        `e2e-move-${conversaId}`,
      ],
    );
    pedidoId = pedido.rows[0]!.id;
  });

  test.afterAll(async () => {
    await gravarAiMode("autonomous").catch(() => undefined);
    await banco.end().catch(() => undefined);
  });

  test("Usar resposta preenche o composer, o envio é humano e o automático para", async ({
    page,
  }) => {
    await gravarAiMode("copilot");
    const atendente = creds.users.agent!;
    await login(page, atendente.email, creds.password);
    await page.goto(`/app/inbox/${conversaId}`);

    const assistente = page.getByTestId("assistente-ia");
    await expect(assistente).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("assistente-resumo")).toContainText(/25 veículos/i);
    await expect(page.getByTestId("assistente-intencao")).toContainText(/preço|PRICE/i);
    await expect(page.getByTestId("assistente-resposta")).toContainText(RASCUNHO);
    await captura(page, "1-sugestao-visivel");

    const { count: outboundAntes, error: cErr } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversaId)
      .eq("direction", "outbound");
    if (cErr) throw new Error(cErr.message);
    expect(outboundAntes ?? 0).toBe(0);
    expect(await silencioNoBanco()).toBe("(null)");

    await page.getByTestId("assistente-usar").click();
    const composer = page.getByTestId("inbox-composer");
    await expect(composer).toHaveValue(RASCUNHO, { timeout: 10_000 });
    await captura(page, "2-rascunho-no-composer");

    const { count: outboundDepoisUsar } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversaId)
      .eq("direction", "outbound");
    expect(outboundDepoisUsar ?? 0).toBe(0);

    await composer.fill(TEXTO_EDITADO);
    await expect(composer).toHaveValue(TEXTO_EDITADO);

    const envio = page.waitForResponse(
      (r) => r.url().includes("/api/v1/messages") && r.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.getByTestId("inbox-enviar").click();
    const res = await envio;
    expect(res.ok(), `POST /messages ${res.status()}: ${await res.text()}`).toBeTruthy();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("messages")
            .select("id, body, sent_via, sent_by_user_id, direction")
            .eq("conversation_id", conversaId)
            .eq("direction", "outbound");
          return data ?? [];
        },
        { timeout: 30_000 },
      )
      .toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            body: TEXTO_EDITADO,
            sent_via: "user",
            sent_by_user_id: atendente.id,
            direction: "outbound",
          }),
        ]),
      );

    await expect.poll(async () => silencioNoBanco(), { timeout: 30_000 }).toMatch(/infinity/);
    await captura(page, "3-envio-humano");

    const { count: iaOut } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversaId)
      .eq("sent_via", "ai");
    expect(iaOut ?? 0).toBe(0);
  });

  test("humano no comando: Copilot ainda sugere, sem envio e sem devolver o comando", async ({
    page,
  }) => {
    await gravarAiMode("copilot");
    await banco.query(
      `update conversations
          set bot_silenced_until = 'infinity',
              assigned_to_user_id = $2,
              last_handoff_reason = 'humano no comando (precondição e2e)'
        where id = $1`,
      [conversaId, creds.users.agent!.id],
    );
    expect(await silencioNoBanco()).toMatch(/infinity/);

    const { data: inbound2, error: e2 } = await admin
      .from("messages")
      .insert({
        organization_id: creds.org_id,
        conversation_id: conversaId,
        channel_session_id: sessaoId,
        contact_id: contatoId,
        type: "text",
        direction: "inbound",
        body: "E tem integração com WhatsApp?",
      })
      .select("id")
      .single();
    if (e2) throw new Error(e2.message);

    await banco.query(
      `insert into ai_copilot_suggestions (
         organization_id, conversation_id, contact_id, inbound_message_id,
         summary, intent, suggested_reply, confidence, status, model
       ) values ($1,$2,$3,$4,$5,'PRODUCT_INFO',$6,0.7,'ready','e2e-seed')`,
      [
        creds.org_id,
        conversaId,
        contatoId,
        (inbound2 as { id: string }).id,
        "Cliente perguntou se há integração com WhatsApp. Ainda no comando humano.",
        "Sim, o atendimento entra pelo WhatsApp.",
      ],
    );

    const atendente = creds.users.agent!;
    await login(page, atendente.email, creds.password);
    await page.goto(`/app/inbox/${conversaId}`);
    await expect(page.getByTestId("assistente-resumo")).toContainText(/WhatsApp/i, {
      timeout: 30_000,
    });
    await captura(page, "4-sugestao-com-humano-no-comando");

    expect(await silencioNoBanco()).toMatch(/infinity/);
    const { count: iaOut } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversaId)
      .eq("sent_via", "ai");
    expect(iaOut ?? 0).toBe(0);
  });

  test("CONTROLLED: confirmar move o lead uma vez e a segunda confirmação é idempotente", async ({
    page,
  }) => {
    await gravarAiMode("controlled");
    const atendente = creds.users.agent!;
    await login(page, atendente.email, creds.password);
    await page.goto(`/app/inbox/${conversaId}`);

    await expect(page.getByTestId("assistente-pedido")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("assistente-pedido")).toContainText(/estágio/i);
    await captura(page, "5-pedido-de-confirmacao");

    await page.getByTestId("assistente-confirmar").click();
    await expect
      .poll(
        async () => {
          const { data } = await admin.from("crm_leads").select("stage_id").eq("id", leadId).single();
          return (data as { stage_id: string } | null)?.stage_id ?? "";
        },
        { timeout: 30_000 },
      )
      .toBe(etapaDestinoId);

    const segunda = await page.request.post(`/api/v1/ai-actions/${pedidoId}/confirm`, {
      data: {},
    });
    expect(segunda.ok()).toBeTruthy();
    const json = (await segunda.json()) as { data?: { idempotent?: boolean } };
    expect(json.data?.idempotent).toBe(true);

    const { data: lead } = await admin.from("crm_leads").select("stage_id").eq("id", leadId).single();
    expect((lead as { stage_id: string }).stage_id).toBe(etapaDestinoId);
    await captura(page, "6-lead-movido");
  });

  test("OFF na org: o card não traz sugestão gerada", async ({ page }) => {
    await gravarAiMode("off");
    const { data: contatoOff, error: cErr } = await admin
      .from("contacts")
      .insert({
        organization_id: creds.org_id,
        display_name: `Off ${Date.now()}`,
        phone_number: `+55118${String(Date.now()).slice(-8)}`,
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    const { data: sessao } = await admin
      .from("channel_sessions")
      .select("id")
      .eq("organization_id", creds.org_id)
      .limit(1)
      .single();
    const { data: convOff, error: vErr } = await admin
      .from("conversations")
      .insert({
        organization_id: creds.org_id,
        contact_id: (contatoOff as { id: string }).id,
        channel_session_id: (sessao as { id: string }).id,
        status: "open",
        last_inbound_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (vErr) throw new Error(vErr.message);

    const atendente = creds.users.agent!;
    await login(page, atendente.email, creds.password);
    await page.goto(`/app/inbox/${(convOff as { id: string }).id}`);
    await expect(page.getByTestId("assistente-ia")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("assistente-ia")).toContainText(/Nenhuma sugestão/i);
    await expect(page.getByTestId("assistente-resumo")).toHaveCount(0);
    await captura(page, "7-off-sem-sugestao");
  });
});
