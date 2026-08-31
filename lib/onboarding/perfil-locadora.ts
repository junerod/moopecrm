/**
 * O QUE UMA LOCADORA RECEBE ALÉM DO QUADRO DO ONBOARDING.
 *
 * O pacote `locadora` em `pacotes-de-funil.ts` é UM quadro — o contrato do
 * wizard. Locadora de verdade organiza duas histórias: quem ainda não
 * fechou o contrato, e a cobrança de quem já é locatário. Sem o segundo
 * quadro, o Kanban mistura visita de captação com boleto atrasado.
 *
 * Este módulo é o plano B completo: vocabulário, campos, motivos de perda
 * e o segundo funil. Quem chama (onboarding futuro ou o script de
 * provisionar) aplica no banco; daqui não sai SQL.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { slugDeNome } from "@/lib/leads/stage-editing";
import { PACOTES } from "@/lib/onboarding/pacotes-de-funil";
import {
  etapasParaGravar,
  validarProposta,
  type PropostaDeFunil,
} from "@/lib/onboarding/proposta-de-funil";

export const PACOTE_LOCADORA = PACOTES.find((p) => p.id === "locadora") ??
  (() => {
    throw new Error("PACOTES sem o pacote de locadora");
  })();

export const FUNIL_COBRANCA: PropostaDeFunil = {
  nome: "Cobrança",
  etapas: [
    { nome: "Em dia", passo: "new" },
    { nome: "Atraso", passo: "contacted" },
    { nome: "Negociando", passo: "qualifying" },
    { nome: "Promessa de pagamento", passo: "negotiating" },
    { nome: "Recuperou", passo: "won" },
    { nome: "Perdeu", passo: "lost" },
  ],
};

export const VOCABULARIO_LOCATARIOS = {
  lead: "Locatário",
  lead_plural: "Locatários",
  deal: "Contrato",
  deal_plural: "Contratos",
  won: "Contrato ativo",
  lost: "Não fechou",
  stage: "Etapa",
  stage_plural: "Etapas",
} as const;

export const VOCABULARIO_COBRANCA = {
  lead: "Locatário",
  lead_plural: "Locatários",
  deal: "Cobrança",
  deal_plural: "Cobranças",
  won: "Recuperou",
  lost: "Perdeu",
  stage: "Etapa",
  stage_plural: "Etapas",
} as const;

export const CAMPOS_LOCATARIOS = [
  {
    key: "veiculo",
    label: "Veículo",
    type: "text" as const,
  },
  {
    key: "numero_do_contrato",
    label: "Número do contrato",
    type: "text" as const,
  },
  {
    key: "como_chegou",
    label: "Como chegou",
    type: "select" as const,
    options: [
      { value: "indicacao", label: "Indicação" },
      { value: "whatsapp", label: "WhatsApp" },
      { value: "99", label: "99" },
      { value: "uber", label: "Uber" },
      { value: "outro", label: "Outro" },
    ],
  },
];

export const CAMPOS_COBRANCA = [
  {
    key: "dias_de_atraso",
    label: "Dias de atraso",
    type: "text" as const,
  },
  {
    key: "valor_em_atraso",
    label: "Valor em atraso",
    type: "text" as const,
  },
];

export const MOTIVOS_DE_PERDA_LOCADORA = [
  "Escolheu outra locadora",
  "Sem condições de entrada",
  "CNH irregular",
  "Score / restrição",
  "Sumiu / não respondeu",
];

function settingsDoFunil(fields: unknown[], extras?: { canonical_tags?: string[] }) {
  return {
    fields,
    canonical_tags: extras?.canonical_tags ?? ["atraso", "frota", "99"],
    lost_reasons: MOTIVOS_DE_PERDA_LOCADORA,
    identity_resolution: { fields_in_priority_order: ["phone_e164", "email", "cpf"] },
  };
}

export interface ResultadoDoPerfilLocadora {
  pipelineLocatariosId: string;
  pipelineCobrancaId: string;
}

/**
 * Troca o funil de e-commerce que o gatilho semeou pelos quadros da locadora.
 *
 * Idempotente: funil de cobrança já existente não é recriado (só recebe
 * vocabulário e campos). Recusar o RPC do quadro padrão (funil com negócio)
 * não derruba o resto — o segundo quadro ainda nasce.
 */
export async function aplicarPerfilLocadora(
  admin: SupabaseClient,
  orgId: string,
): Promise<ResultadoDoPerfilLocadora> {
  const vereditoCobranca = validarProposta(FUNIL_COBRANCA);
  if (!vereditoCobranca.ok) {
    throw new Error(`funil de cobrança inválido: ${vereditoCobranca.erros.join(" ")}`);
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

  const pipelineLocatariosId = (padrao as { id: string }).id;
  const proposta = PACOTE_LOCADORA.proposta;
  const { data: outros } = await admin
    .from("crm_pipelines")
    .select("slug")
    .eq("organization_id", orgId)
    .neq("id", pipelineLocatariosId);
  const slug = slugDeNome(
    proposta.nome,
    (outros ?? []).map((p) => String((p as { slug?: string }).slug ?? "")),
    "funil",
  );

  const { data: resposta, error: erroRpc } = await admin.rpc("fn_aplicar_quadro_do_onboarding", {
    p_organization_id: orgId,
    p_pipeline_id: pipelineLocatariosId,
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
    throw new Error(`aplicar quadro de locatários: ${erroRpc.message}`);
  }
  const r = (resposta ?? {}) as { ok?: boolean; motivo?: string };
  if (r.ok === false && r.motivo !== "funil_com_negocios") {
    throw new Error(`aplicar quadro de locatários: ${r.motivo ?? "recusa"}`);
  }

  const { error: erroVocab } = await admin
    .from("crm_pipelines")
    .update({
      vocabulary: VOCABULARIO_LOCATARIOS,
      settings: settingsDoFunil(CAMPOS_LOCATARIOS),
    } as never)
    .eq("id", pipelineLocatariosId)
    .eq("organization_id", orgId);
  if (erroVocab) throw new Error(`vocabulário de locatários: ${erroVocab.message}`);

  const pipelineCobrancaId = await garantirFunilCobranca(admin, orgId);

  return { pipelineLocatariosId, pipelineCobrancaId };
}

async function garantirFunilCobranca(admin: SupabaseClient, orgId: string): Promise<string> {
  const slugAlvo = slugDeNome(FUNIL_COBRANCA.nome, [], "cobranca");
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
        name: FUNIL_COBRANCA.nome,
        vocabulary: VOCABULARIO_COBRANCA,
        settings: settingsDoFunil(CAMPOS_COBRANCA),
      } as never)
      .eq("id", id)
      .eq("organization_id", orgId);
    if (error) throw new Error(`atualizar cobrança: ${error.message}`);
    return id;
  }

  const { data, error } = await admin
    .from("crm_pipelines")
    .insert({
      organization_id: orgId,
      name: FUNIL_COBRANCA.nome,
      slug: slugAlvo,
      description: "Acompanhamento de atraso e recuperação de quem já é locatário.",
      is_default: false,
      position: 2000,
      vocabulary: VOCABULARIO_COBRANCA,
      settings: settingsDoFunil(CAMPOS_COBRANCA),
    } as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(`criar funil de cobrança: ${error?.message}`);
  const id = (data as { id: string }).id;

  const horasPorPasso: Record<string, number> = {
    new: 24,
    contacted: 48,
    qualifying: 72,
    qualified: 48,
    negotiating: 72,
  };
  const etapas = etapasParaGravar(FUNIL_COBRANCA, slugDeNome);
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
  if (erroEtapas) throw new Error(`etapas de cobrança: ${erroEtapas.message}`);
  return id;
}
