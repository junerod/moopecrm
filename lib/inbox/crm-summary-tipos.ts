/** Contrato do GET /contacts/{id}/crm-summary — o que a ficha da Inbox lê. */

export interface PipelineFicha {
  id: string;
  name: string;
  is_default: boolean;
}

export interface EtapaFicha {
  id: string;
  name: string;
  pipeline_id: string;
  is_won: boolean;
  is_lost: boolean;
}

export interface OwnerFicha {
  user_id: string | null;
  agent_id: string | null;
  display_name: string | null;
}

export interface LeadFicha {
  id: string;
  title: string;
  status: string;
  value_cents: number | null;
  currency: string | null;
  updated_at: string;
  last_activity_at: string | null;
  source: string | null;
  pipeline: PipelineFicha | null;
  stage: EtapaFicha | null;
  owner: OwnerFicha;
  temperatura: string | null;
}

export interface PipelineUtilizavel {
  id: string;
  name: string;
  is_default: boolean;
  etapas: EtapaFicha[];
}

export interface ProximoPassoComercial {
  demanda_id: string;
  proximo_passo: string | null;
  proximo_passo_em: string | null;
}

export type ResolucaoNegocio = "nenhum" | "unico" | "varios";

export interface NegocioFicha {
  resolucao: ResolucaoNegocio;
  lead_id: string | null;
  leads_abertos: LeadFicha[];
}

export interface CrmSummaryData {
  leads: LeadFicha[];
  negocio: NegocioFicha;
  pipelines_utilizaveis: PipelineUtilizavel[];
  proximo_passo_comercial: ProximoPassoComercial | null;
  orders: Array<{
    id: string;
    external_id: string | null;
    status: string | null;
    total_cents: number | null;
    currency: string | null;
    created_at: string;
  }>;
  activities: Array<{
    id: string;
    type: string;
    source_module: string;
    performed_at: string;
    payload: Record<string, unknown> | null;
    reason: string | null;
    actor_kind: string | null;
    performed_by_name?: string | null;
  }>;
  demandas: Array<{
    id: string;
    aberta_em: string;
    origem: string;
    estado: string;
    proximo_passo: string | null;
    proximo_passo_em: string | null;
    prazo_em: string | null;
  }>;
}

export function resolverNegocioAberto(leads: LeadFicha[]): NegocioFicha {
  const abertos = leads.filter((l) => l.status === "open");
  if (abertos.length === 0) {
    return { resolucao: "nenhum", lead_id: null, leads_abertos: [] };
  }
  if (abertos.length === 1) {
    return { resolucao: "unico", lead_id: abertos[0]!.id, leads_abertos: abertos };
  }
  return { resolucao: "varios", lead_id: null, leads_abertos: abertos };
}
