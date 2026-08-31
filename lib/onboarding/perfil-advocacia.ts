/**
 * O QUE UM ESCRITÓRIO RECEBE ALÉM DO QUADRO DO ONBOARDING.
 *
 * O pacote `advocacia` em `pacotes-de-funil.ts` é UM quadro — o contrato do
 * wizard. Escritório de verdade organiza duas histórias: quem ainda não
 * contratou, e o processo de quem já é cliente. Sem o segundo quadro, o Kanban
 * mistura consulta de captação com prazo de audiência.
 *
 * Este módulo é o plano B completo: vocabulário, campos, motivos de perda,
 * tipos de agenda e o segundo funil. Quem chama (onboarding futuro ou o
 * script de provisionar) aplica no banco; daqui não sai SQL.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { slugDeNome } from "@/lib/leads/stage-editing";
import { PACOTES } from "@/lib/onboarding/pacotes-de-funil";
import {
  etapasParaGravar,
  validarProposta,
  type PropostaDeFunil,
} from "@/lib/onboarding/proposta-de-funil";

export const PACOTE_ADVOCACIA = PACOTES.find((p) => p.id === "advocacia") ??
  (() => {
    throw new Error("PACOTES sem o pacote de advocacia");
  })();

export const FUNIL_PROCESSOS: PropostaDeFunil = {
  nome: "Processos",
  etapas: [
    { nome: "Novo processo", passo: "new" },
    { nome: "Documentos", passo: "contacted" },
    { nome: "Em andamento", passo: "qualifying" },
    { nome: "Audiência marcada", passo: "qualified" },
    { nome: "Aguardando decisão", passo: "negotiating" },
    { nome: "Encerrado", passo: "won" },
    { nome: "Arquivado", passo: "lost" },
  ],
};

export const VOCABULARIO_NOVOS_CLIENTES = {
  lead: "Cliente",
  lead_plural: "Clientes",
  deal: "Caso",
  deal_plural: "Casos",
  won: "Contratou",
  lost: "Não contratou",
  stage: "Etapa",
  stage_plural: "Etapas",
} as const;

export const VOCABULARIO_PROCESSOS = {
  lead: "Cliente",
  lead_plural: "Clientes",
  deal: "Processo",
  deal_plural: "Processos",
  won: "Encerrado",
  lost: "Arquivado",
  stage: "Etapa",
  stage_plural: "Etapas",
} as const;

const AREAS_DO_DIREITO = [
  { value: "trabalhista", label: "Trabalhista" },
  { value: "civel", label: "Cível" },
  { value: "familia", label: "Família" },
  { value: "criminal", label: "Criminal" },
  { value: "tributario", label: "Tributário" },
  { value: "consumidor", label: "Consumidor" },
  { value: "previdenciario", label: "Previdenciário" },
  { value: "outro", label: "Outra área" },
] as const;

export const CAMPOS_NOVOS_CLIENTES = [
  {
    key: "area_do_direito",
    label: "Área do direito",
    type: "select" as const,
    options: [...AREAS_DO_DIREITO],
  },
  {
    key: "como_chegou",
    label: "Como chegou",
    type: "select" as const,
    options: [
      { value: "indicacao", label: "Indicação" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "instagram", label: "Instagram" },
      { value: "google", label: "Google" },
      { value: "outro", label: "Outro" },
    ],
  },
];

export const CAMPOS_PROCESSOS = [
  {
    key: "numero_do_processo",
    label: "Número do processo",
    type: "text" as const,
  },
  {
    key: "parte_contraria",
    label: "Parte contrária",
    type: "text" as const,
  },
  {
    key: "vara_ou_juizo",
    label: "Vara / juízo",
    type: "text" as const,
  },
  {
    key: "area_do_direito",
    label: "Área do direito",
    type: "select" as const,
    options: [...AREAS_DO_DIREITO],
  },
];

export const MOTIVOS_DE_PERDA = [
  "Escolheu outro escritório",
  "Sem condições de honorários",
  "Não era o caso",
  "Já tem advogado",
  "Sumiu / não respondeu",
];

export const TIPOS_DE_AGENDA = [
  { nome: "Consulta inicial", slug: "consulta-inicial", category: "consulta", duration_minutes: 60, position: 4000 },
  { nome: "Audiência", slug: "audiencia", category: "reuniao", duration_minutes: 120, position: 5000 },
  { nome: "Prazo", slug: "prazo", category: "outro", duration_minutes: 15, position: 6000 },
] as const;

function settingsDoFunil(fields: unknown[], extras?: { canonical_tags?: string[] }) {
  return {
    fields,
    canonical_tags: extras?.canonical_tags ?? ["urgente", "trabalhista", "civel"],
    lost_reasons: MOTIVOS_DE_PERDA,
    identity_resolution: { fields_in_priority_order: ["phone_e164", "email", "cpf"] },
  };
}

export interface ResultadoDoPerfil {
  pipelineNovosClientesId: string;
  pipelineProcessosId: string;
  tiposDeAgendaCriados: number;
}

/**
 * Troca o funil de e-commerce que o gatilho semeou pelos quadros do escritório.
 *
 * Idempotente: funil de processos já existente não é recriado (só recebe
 * vocabulário e campos). Recusar o RPC do quadro padrão (funil com negócio)
 * não derruba o resto — o segundo quadro e a agenda ainda nascem.
 */
export async function aplicarPerfilAdvocacia(
  admin: SupabaseClient,
  orgId: string,
): Promise<ResultadoDoPerfil> {
  const vereditoProcessos = validarProposta(FUNIL_PROCESSOS);
  if (!vereditoProcessos.ok) {
    throw new Error(`funil de processos inválido: ${vereditoProcessos.erros.join(" ")}`);
  }

  const { data: padrao, error: erroPadrao } = await admin
    .from("crm_pipelines")
    .select("id, slug")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  if (erroPadrao || !padrao) {
    throw new Error(`sem funil padrão: ${erroPadrao?.message ?? "não achei"}`);
  }

  const pipelineNovosClientesId = (padrao as { id: string }).id;
  const proposta = PACOTE_ADVOCACIA.proposta;
  const { data: outros } = await admin
    .from("crm_pipelines")
    .select("slug")
    .eq("organization_id", orgId)
    .neq("id", pipelineNovosClientesId);
  const slug = slugDeNome(
    proposta.nome,
    (outros ?? []).map((p) => String((p as { slug?: string }).slug ?? "")),
    "funil",
  );

  const { data: resposta, error: erroRpc } = await admin.rpc("fn_aplicar_quadro_do_onboarding", {
    p_organization_id: orgId,
    p_pipeline_id: pipelineNovosClientesId,
    p_nome: proposta.nome,
    p_slug: slug,
    p_etapas: etapasParaGravar(proposta, slugDeNome).map((e) => ({
      nome: e.nome,
      slug: e.slug,
      position: e.position,
      is_won: e.is_won,
      is_lost: e.is_lost,
      agent_stage_hint: e.agent_stage_hint,
    })),
  });
  if (erroRpc) {
    throw new Error(`aplicar quadro de captação: ${erroRpc.message}`);
  }
  const r = (resposta ?? {}) as { ok?: boolean; motivo?: string };
  if (r.ok === false && r.motivo !== "funil_com_negocios") {
    throw new Error(`aplicar quadro de captação: ${r.motivo ?? "recusa"}`);
  }

  const { error: erroVocab } = await admin
    .from("crm_pipelines")
    .update({
      vocabulary: VOCABULARIO_NOVOS_CLIENTES,
      settings: settingsDoFunil(CAMPOS_NOVOS_CLIENTES),
    } as never)
    .eq("id", pipelineNovosClientesId)
    .eq("organization_id", orgId);
  if (erroVocab) throw new Error(`vocabulário de captação: ${erroVocab.message}`);

  const pipelineProcessosId = await garantirFunilProcessos(admin, orgId);
  const tiposDeAgendaCriados = await garantirTiposDeAgenda(admin, orgId);

  return { pipelineNovosClientesId, pipelineProcessosId, tiposDeAgendaCriados };
}

async function garantirFunilProcessos(admin: SupabaseClient, orgId: string): Promise<string> {
  const slugAlvo = slugDeNome(FUNIL_PROCESSOS.nome, [], "processos");
  const { data: existente } = await admin
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", orgId)
    .eq("slug", slugAlvo)
    .maybeSingle();

  if (existente) {
    const id = (existente as { id: string }).id;
    const { error } = await admin
      .from("crm_pipelines")
      .update({
        name: FUNIL_PROCESSOS.nome,
        vocabulary: VOCABULARIO_PROCESSOS,
        settings: settingsDoFunil(CAMPOS_PROCESSOS),
      } as never)
      .eq("id", id)
      .eq("organization_id", orgId);
    if (error) throw new Error(`atualizar processos: ${error.message}`);
    return id;
  }

  const { data, error } = await admin
    .from("crm_pipelines")
    .insert({
      organization_id: orgId,
      name: FUNIL_PROCESSOS.nome,
      slug: slugAlvo,
      description: "Acompanhamento dos processos de quem já é cliente.",
      is_default: false,
      position: 2000,
      vocabulary: VOCABULARIO_PROCESSOS,
      settings: settingsDoFunil(CAMPOS_PROCESSOS),
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`criar funil de processos: ${error?.message}`);
  const id = (data as { id: string }).id;

  const horasPorPasso: Record<string, number> = {
    new: 24,
    contacted: 72,
    qualifying: 168,
    qualified: 72,
    negotiating: 336,
  };
  const etapas = etapasParaGravar(FUNIL_PROCESSOS, slugDeNome);
  const { error: erroEtapas } = await admin.from("crm_stages").insert(
    etapas.map((e) => ({
      organization_id: orgId,
      pipeline_id: id,
      name: e.nome,
      slug: e.slug,
      position: e.position,
      is_won: e.is_won,
      is_lost: e.is_lost,
      agent_stage_hint: e.agent_stage_hint,
      expected_duration_hours: e.agent_stage_hint
        ? (horasPorPasso[e.agent_stage_hint] ?? null)
        : null,
    })) as never,
  );
  if (erroEtapas) throw new Error(`etapas de processos: ${erroEtapas.message}`);
  return id;
}

async function garantirTiposDeAgenda(admin: SupabaseClient, orgId: string): Promise<number> {
  let criados = 0;
  for (const tipo of TIPOS_DE_AGENDA) {
    const { data: ja } = await admin
      .from("calendar_event_types")
      .select("id")
      .eq("organization_id", orgId)
      .eq("slug", tipo.slug)
      .maybeSingle();
    if (ja) continue;
    const { error } = await admin.from("calendar_event_types").insert({
      organization_id: orgId,
      name: tipo.nome,
      slug: tipo.slug,
      category: tipo.category,
      duration_minutes: tipo.duration_minutes,
      position: tipo.position,
    } as never);
    if (error) throw new Error(`tipo de agenda ${tipo.slug}: ${error.message}`);
    criados += 1;
  }
  return criados;
}
