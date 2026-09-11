/**
 * Onde um lead AUTOMÁTICO nasce — distinto do funil `is_default`.
 *
 * `is_default` continua sendo o padrão técnico/legado (Kanban, Ready Model,
 * seed de org nova). O pipeline de entrada comercial é outra decisão: uma
 * organização pode ter Locatários como padrão e ainda assim querer que
 * conversa nova abra oportunidade noutro funil.
 *
 * Persistido em `organizations.settings.crm.inbound_pipeline_id`. Sem coluna
 * nova, sem nome de vertical, sem id de tenant.
 *
 * Resolução:
 *   1. inbound explícito, da mesma org, não arquivado, com etapa aberta
 *   2. fallback para `is_default`
 *   3. nenhum válido → o mesmo recusa de sempre (`sem_funil_de_entrada` /
 *      `sem_etapa`). Não escolhe funil arbitrário.
 *
 * Org sem a chave continua no comportamento antigo: só `is_default`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CHAVE_CRM = "crm";

export type ErroDeFunilDeNascimento = "sem_funil_de_entrada" | "sem_etapa";

export type DestinoDeNascimento =
  | { pipelineId: string; stageId: string }
  | { erro: ErroDeFunilDeNascimento };

/**
 * Lê o id configurado. Inválido/ausente = não configurado (fallback).
 * Não consulta o banco — só o JSONB.
 */
export function lerInboundPipelineId(settings: unknown): string | null {
  if (!settings || typeof settings !== "object") return null;
  const crm = (settings as Record<string, unknown>)[CHAVE_CRM];
  if (!crm || typeof crm !== "object") return null;
  const raw = (crm as Record<string, unknown>).inbound_pipeline_id;
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!UUID_RE.test(id)) return null;
  return id;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Escolha pura: inbound válido vence; senão o default; senão recusa. */
export function escolherPipelineDeNascimento(args: {
  inboundPipelineId: string | null;
  inboundEhValido: boolean;
  defaultPipelineId: string | null;
}): { pipelineId: string } | { erro: "sem_funil_de_entrada" } {
  if (args.inboundPipelineId && args.inboundEhValido) {
    return { pipelineId: args.inboundPipelineId };
  }
  if (args.defaultPipelineId) return { pipelineId: args.defaultPipelineId };
  return { erro: "sem_funil_de_entrada" };
}

/**
 * Qual funil a lista deve mostrar como "novos leads entram em".
 * Id configurado só vale se ainda está na lista (não arquivado).
 */
export function idEfetivoDeNovosLeads(
  funis: Array<{ id: string; is_default: boolean }>,
  inboundPipelineId: string | null,
): string | null {
  if (inboundPipelineId && funis.some((f) => f.id === inboundPipelineId)) {
    return inboundPipelineId;
  }
  return funis.find((f) => f.is_default)?.id ?? funis[0]?.id ?? null;
}

export function mesclarCrmSettings(
  settings: Record<string, unknown>,
  inboundPipelineId: string | null,
): Record<string, unknown> {
  const atual =
    settings[CHAVE_CRM] && typeof settings[CHAVE_CRM] === "object"
      ? { ...(settings[CHAVE_CRM] as Record<string, unknown>) }
      : {};
  return {
    ...settings,
    [CHAVE_CRM]: { ...atual, inbound_pipeline_id: inboundPipelineId },
  };
}

/**
 * Semear o inbound do Ready Model só quando o tenant ainda não escolheu.
 * Chave presente (mesmo que aponte para o quadro do modelo) = não toca.
 */
export function semearInboundSeAusente(
  settings: Record<string, unknown>,
  pipelineId: string,
): Record<string, unknown> {
  if (lerInboundPipelineId(settings) !== null) return settings;
  return mesclarCrmSettings(settings, pipelineId);
}

export async function primeiraEtapaAberta(
  db: SupabaseClient,
  organizationId: string,
  pipelineId: string,
): Promise<string | null> {
  const { data: etapa } = await db
    .from("crm_stages")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("pipeline_id", pipelineId)
    .eq("is_archived", false)
    .eq("is_won", false)
    .eq("is_lost", false)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();
  return etapa ? (etapa.id as string) : null;
}

/**
 * Pipeline da MESMA org, não arquivado, com etapa aberta utilizável.
 * Id de outra org, arquivado ou sem etapa = inválido (fallback).
 */
export async function pipelineUtilizavelParaNascimento(
  db: SupabaseClient,
  organizationId: string,
  pipelineId: string,
): Promise<{ pipelineId: string; stageId: string } | null> {
  const { data: funil } = await db
    .from("crm_pipelines")
    .select("id")
    .eq("id", pipelineId)
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .maybeSingle();
  if (!funil) return null;
  const stageId = await primeiraEtapaAberta(db, organizationId, pipelineId);
  if (!stageId) return null;
  return { pipelineId, stageId };
}

async function funilPadraoTecnico(
  db: SupabaseClient,
  organizationId: string,
): Promise<string | null> {
  const { data: funil } = await db
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  return funil ? (funil.id as string) : null;
}

export async function resolverFunilDeNascimento(
  db: SupabaseClient,
  organizationId: string,
): Promise<DestinoDeNascimento> {
  const { data: org } = await db
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();
  const inboundId = lerInboundPipelineId(org?.settings);
  if (inboundId) {
    const inbound = await pipelineUtilizavelParaNascimento(db, organizationId, inboundId);
    if (inbound) return inbound;
  }

  const defaultId = await funilPadraoTecnico(db, organizationId);
  if (!defaultId) return { erro: "sem_funil_de_entrada" };
  const padrao = await pipelineUtilizavelParaNascimento(db, organizationId, defaultId);
  if (padrao) return padrao;
  // Funil padrão existe mas não tem etapa aberta — o recusa antigo, não um
  // terceiro funil qualquer da lista.
  return { erro: "sem_etapa" };
}
