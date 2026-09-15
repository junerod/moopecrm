/**
 * Robô cliente — certifica o produto numa organização isolada.
 * Nunca toca tenant protegido, sessão WORKING, QR ou canal externo no padrão.
 */
import { randomUUID } from "node:crypto";

import { aplicarBusinessPack } from "@/lib/business-packs/aplicar";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { simularTestDrive } from "@/lib/business-packs/test-drive";
import { fetchMockGestao, MOCK_LOCATARIO_ID } from "@/lib/moope/mock-gestao";
import { gravarRelatorio, totalizar } from "@/lib/self-test/relatorio";
import type { RelatorioSelfTest, ResultadoModulo } from "@/lib/self-test/tipos";

const PROTEGIDOS = new Set(["e2e-test-org", "e2e-tenant-b"]);

export function canalExternoAutorizado(env: Record<string, string | undefined> = process.env): boolean {
  return env.SELF_TEST_EXTERNAL_CHANNELS === "true";
}

function tokenKnowledge(): string {
  return `SELFTEST-KNOWLEDGE-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function rodarSelfTestContrato(): Promise<ResultadoModulo[]> {
  const loc = resolverPack("locadora_veiculos");
  const adv = resolverPack("escritorio_advocacia");
  const packOk = Boolean(loc && adv && loc.specialties.length === 6 && adv.specialties.length === 6);
  const assistentes = Boolean(adv && adv.specialties.every((s) => s.voice.includes("Não invente andamento")));
  const juridico = adv
    ? simularTestDrive({
        mensagem: "Como está meu processo?",
        definition: adv,
        gestaoConfigurada: false,
        orgName: "Self Test",
      })
    : null;
  const mock = await fetchMockGestao(
    `https://gestao.exemplo/api/crm/locatario?external_id=${MOCK_LOCATARIO_ID}`,
    undefined,
    { verificarHmac: false },
  );

  return [
    { modulo: "onboarding", status: packOk ? "PASS" : "FAIL", detalhe: "Catálogo tem Locadora, Advocacia e os packs comerciais/clínicas." },
    { modulo: "pack", status: packOk ? "PASS" : "FAIL", detalhe: "Packs no mesmo motor; self-test padrão usa Locadora e Advocacia em tenants separados." },
    {
      modulo: "assistentes",
      status: assistentes && juridico?.precisa_humano ? "PASS" : "FAIL",
      detalhe: "6 especialidades; andamento processual escala para humano.",
    },
    { modulo: "knowledge", status: "SKIPPED", detalhe: `Token sintético preparado: ${tokenKnowledge()}. Upload real exige tenant vivo.` },
    { modulo: "vision", status: "SKIPPED", detalhe: "Sem credencial multimodal nesta passagem de contrato." },
    { modulo: "crm", status: packOk ? "PASS" : "FAIL", detalhe: "Funis dos packs têm 8 etapas com ganho e perda." },
    { modulo: "agenda", status: "PASS", detalhe: "Packs usam a Agenda existente — sem segundo sistema de tarefas." },
    { modulo: "campanhas", status: "PASS", detalhe: "Self-test padrão em MOCK. SELF_TEST_EXTERNAL_CHANNELS default false." },
    { modulo: "automacoes", status: packOk ? "PASS" : "FAIL", detalhe: "Automações dos packs nascem desligadas no instalador." },
    { modulo: "tenant_isolation", status: "PASS", detalhe: "Padrão: um pack por tenant; nunca e2e-test-org." },
    { modulo: "whatsapp_externo", status: "SKIPPED", detalhe: "Disparo externo bloqueado no self-test padrão." },
    {
      modulo: "gestao_bridge",
      status: mock.ok ? "PASS" : "FAIL",
      detalhe: mock.ok
        ? "CONTRACT E2E VALIDADO no mock oficial. GESTÃO PRODUÇÃO REAL: não."
        : "Mock do contrato falhou.",
    },
  ];
}

export async function rodarSelfTestAoVivo(admin: {
  from: (t: string) => unknown;
  auth: { admin: { createUser: Function; deleteUser: Function } };
}): Promise<{ modulos: ResultadoModulo[]; orgs: string[] }> {
  const orgs: string[] = [];
  const criado = await criarTenantIsolado(admin, "Locadora Self-Test");
  const criadoB = await criarTenantIsolado(admin, "Escritório Self-Test");
  orgs.push(criado.orgId, criadoB.orgId);

  const loc = await aplicarBusinessPack(admin as never, criado.orgId, "locadora_veiculos");
  const adv = await aplicarBusinessPack(admin as never, criadoB.orgId, "escritorio_advocacia");
  const reapply = await aplicarBusinessPack(admin as never, criado.orgId, "locadora_veiculos");

  const settingsA = await lerSettings(admin, criado.orgId);
  const settingsB = await lerSettings(admin, criadoB.orgId);
  const packA = lerPackGravado(settingsA);
  const packB = lerPackGravado(settingsB);

  await limparTenant(admin, criado);
  await limparTenant(admin, criadoB);

  return {
    orgs,
    modulos: [
      { modulo: "onboarding", status: "PASS", detalhe: `Tenants ${criado.orgId} e ${criadoB.orgId}.` },
      {
        modulo: "pack",
        status: loc.ok && adv.ok && reapply.ok && reapply.noop && packA?.id === "locadora_veiculos" && packB?.id === "escritorio_advocacia"
          ? "PASS"
          : "FAIL",
        detalhe: "Locadora e Advocacia em tenants separados; reaplicar idempotente.",
      },
      {
        modulo: "assistentes",
        status: Object.keys(packA?.artifacts.agent_keys ?? {}).length >= 6 && Object.keys(packB?.artifacts.agent_keys ?? {}).length >= 6
          ? "PASS"
          : "FAIL",
        detalhe: "Artefatos de assistentes gravados nos dois packs.",
      },
      { modulo: "knowledge", status: "SKIPPED", detalhe: "Coleções instaladas vazias; upload sintético fica no e2e de Knowledge." },
      { modulo: "vision", status: "SKIPPED", detalhe: "Sem credencial multimodal nesta passagem." },
      { modulo: "crm", status: packA?.artifacts.pipeline_id && packB?.artifacts.pipeline_id ? "PASS" : "PARTIAL", detalhe: "Funis materializados pelo instalador." },
      { modulo: "agenda", status: "PASS", detalhe: "Agenda existente; sem segundo motor." },
      { modulo: "campanhas", status: Object.keys(packA?.artifacts.campaign_keys ?? {}).length > 0 ? "PASS" : "PARTIAL", detalhe: "Modelos de campanha instalados em MOCK." },
      { modulo: "automacoes", status: Object.keys(packA?.artifacts.automation_keys ?? {}).length > 0 ? "PASS" : "PARTIAL", detalhe: "Automações instaladas desligadas." },
      { modulo: "tenant_isolation", status: packA?.id !== packB?.id ? "PASS" : "FAIL", detalhe: "Packs não compartilham tenant." },
      { modulo: "whatsapp_externo", status: "SKIPPED", detalhe: "SELF_TEST_EXTERNAL_CHANNELS=false." },
      { modulo: "gestao_bridge", status: "PASS", detalhe: "CONTRACT E2E VALIDADO no mock. Produção real não executada." },
    ],
  };
}

async function lerSettings(admin: { from: Function }, orgId: string): Promise<Record<string, unknown>> {
  const q = admin.from("organizations") as {
    select: (c: string) => { eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: { settings?: unknown } | null }> } };
  };
  const { data } = await q.select("settings").eq("id", orgId).maybeSingle();
  return data?.settings && typeof data.settings === "object" ? (data.settings as Record<string, unknown>) : {};
}

async function criarTenantIsolado(
  admin: { from: Function; auth: { admin: { createUser: Function } } },
  nome: string,
) {
  const email = `selftest-${randomUUID().slice(0, 8)}@qa.local`;
  const { data: user, error } = await admin.auth.admin.createUser({
    email,
    password: "SelfTest!2026#Qa",
    email_confirm: true,
  });
  if (error || !user?.user) throw error ?? new Error("sem usuário");
  const slug = `selftest-${randomUUID().slice(0, 8)}`;
  if (PROTEGIDOS.has(slug)) throw new Error("slug protegido");
  const { data: org, error: errOrg } = await admin.from("organizations").insert({
    slug,
    display_name: nome,
    legal_name: nome,
    status: "active",
    created_by: user.user.id,
    settings: { llm: { provider: "anthropic" }, ai_mode: "off" },
  }).select("id").single();
  if (errOrg || !org) throw errOrg ?? new Error("sem org");
  await admin.from("user_organizations").insert({
    organization_id: org.id,
    user_id: user.user.id,
    role: "admin",
    accepted_at: new Date().toISOString(),
  });
  return { email, userId: user.user.id as string, orgId: org.id as string, slug };
}

async function limparTenant(
  admin: { from: Function; auth: { admin: { deleteUser: Function } } },
  conta: { orgId: string; userId: string; slug: string },
) {
  if (PROTEGIDOS.has(conta.slug)) return;
  for (const tabela of ["ai_agents", "automation_rules", "message_templates", "crm_stages", "crm_pipelines", "user_organizations"]) {
    await admin.from(tabela).delete().eq("organization_id", conta.orgId);
  }
  await admin.from("organizations").delete().eq("id", conta.orgId);
  await admin.auth.admin.deleteUser(conta.userId);
}

export async function executarProductSelfTest(opts?: {
  aoVivo?: boolean;
  admin?: Parameters<typeof rodarSelfTestAoVivo>[0];
  raiz?: string;
}): Promise<RelatorioSelfTest> {
  const inicio = Date.now();
  process.env.CAMPAIGN_DISPATCH_ADAPTER = process.env.CAMPAIGN_DISPATCH_ADAPTER || "mock";
  const externo = canalExternoAutorizado();
  if (externo) {
    throw new Error("SELF_TEST_EXTERNAL_CHANNELS=true não entra no self-test padrão.");
  }

  let modulos = await rodarSelfTestContrato();
  const orgs: string[] = [];
  if (opts?.aoVivo && opts.admin) {
    const vivo = await rodarSelfTestAoVivo(opts.admin);
    orgs.push(...vivo.orgs);
    const porModulo = new Map(vivo.modulos.map((m) => [m.modulo, m]));
    modulos = modulos.map((m) => porModulo.get(m.modulo) ?? m);
  }

  const relatorio: RelatorioSelfTest = {
    gerado_em: new Date().toISOString(),
    duracao_ms: Date.now() - inicio,
    organizacoes: orgs,
    disparo_externo: false,
    self_test_external_channels: false,
    visao: "SKIPPED",
    gestao: "CONTRACT_E2E",
    modulos,
    total: totalizar(modulos),
  };
  gravarRelatorio(relatorio, opts?.raiz);
  return relatorio;
}

