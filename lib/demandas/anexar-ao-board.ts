import type { SupabaseClient } from "@supabase/supabase-js";

import type { Lead, ProximaAcaoComercial } from "@/lib/types/leads";

type DemandaComPasso = {
  id: string;
  lead_id: string | null;
  contact_id: string | null;
  proximo_passo: string | null;
  proximo_passo_em: string | null;
  dono_user_id: string | null;
};

/**
 * Anexa a próxima ação CANÔNICA (`demandas`) aos leads do board.
 * `lead.next_action` continua sendo a proposta da IA.
 *
 * A leitura é por organização + passo aberto — NÃO `lead_id.in.(todos)`.
 * Medido no E2E do Bloco 2: o `.or(lead_id.in.(…))` estourou "URI too long"
 * no PostgREST quando o funil de teste já tinha dezenas de leads residuais.
 */
export async function withProximasAcoesComerciais(
  supabase: SupabaseClient,
  organizationId: string,
  leads: Lead[],
): Promise<{ leads: Lead[]; error: string | null }> {
  if (leads.length === 0) return { leads, error: null };

  const { data, error } = await supabase
    .from("demandas")
    .select("id, lead_id, contact_id, proximo_passo, proximo_passo_em, dono_user_id")
    .eq("organization_id", organizationId)
    .is("fechada_em", null)
    .not("proximo_passo", "is", null);
  if (error) return { leads, error: error.message };

  return {
    leads: anexarAcoesAosLeads(leads, (data ?? []) as DemandaComPasso[]),
    error: null,
  };
}

export function anexarAcoesAosLeads(
  leads: Lead[],
  demandas: DemandaComPasso[],
): Lead[] {
  const leadIds = new Set(leads.map((l) => l.id));
  const contactIds = new Set(
    leads.map((l) => l.contact_id).filter((c): c is string => !!c),
  );

  const porLead = new Map<string, ProximaAcaoComercial>();
  const porContato = new Map<string, ProximaAcaoComercial>();
  for (const row of demandas) {
    const acao: ProximaAcaoComercial = {
      demanda_id: row.id,
      texto: row.proximo_passo ?? "",
      em: row.proximo_passo_em,
      dono_user_id: row.dono_user_id,
    };
    if (!acao.texto.trim()) continue;
    if (row.lead_id && leadIds.has(row.lead_id)) {
      const atual = porLead.get(row.lead_id);
      if (!atual || maisCedo(acao.em, atual.em)) porLead.set(row.lead_id, acao);
    } else if (!row.lead_id && row.contact_id && contactIds.has(row.contact_id)) {
      const atual = porContato.get(row.contact_id);
      if (!atual || maisCedo(acao.em, atual.em)) porContato.set(row.contact_id, acao);
    }
  }

  return leads.map((lead) => {
    const acao =
      porLead.get(lead.id) ?? (lead.contact_id ? porContato.get(lead.contact_id) : undefined);
    return acao ? { ...lead, proxima_acao: acao } : { ...lead, proxima_acao: null };
  });
}

function maisCedo(a: string | null, b: string | null): boolean {
  if (!a) return false;
  if (!b) return true;
  return new Date(a).getTime() < new Date(b).getTime();
}
