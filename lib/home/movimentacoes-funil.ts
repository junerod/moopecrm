/**
 * Alterações recentes de etapa — lê o barramento que já existe.
 *
 * Não cria tabela nova: `crm_lead_activities` type=stage_changed já é o
 * rastro. A Início e o sino só passam a MOSTRAR o que o quadro já grava.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const LIMITE_MOVIMENTACOES_FUNIL = 15;
export const JANELA_MOVIMENTACOES_MS = 48 * 60 * 60 * 1000;

export interface MovimentacaoDoFunil {
  activity_id: string;
  lead_id: string;
  titulo: string;
  texto: string;
  em: string;
}

export interface PedidoDeMovimentacoes {
  organizationId: string;
  userId: string;
  /** Agent só vê o que é dele. Gestor vê o quadro inteiro. */
  soDoDono: boolean;
  agora?: Date;
  limite?: number;
}

type Atividade = {
  id: string;
  lead_id: string;
  reason: string | null;
  performed_at: string;
};

type Lead = {
  id: string;
  title: string | null;
  owner_user_id: string | null;
};

export function montarMovimentacao(
  atividade: Atividade,
  lead: Lead | null,
): MovimentacaoDoFunil {
  const titulo = lead?.title?.trim() || "Negócio";
  const texto = atividade.reason?.trim() || "Mudou de etapa";
  return {
    activity_id: atividade.id,
    lead_id: atividade.lead_id,
    titulo,
    texto,
    em: atividade.performed_at,
  };
}

export async function listarMovimentacoesDoFunil(
  db: SupabaseClient,
  pedido: PedidoDeMovimentacoes,
): Promise<MovimentacaoDoFunil[]> {
  const agora = pedido.agora ?? new Date();
  const limite = pedido.limite ?? LIMITE_MOVIMENTACOES_FUNIL;
  const desde = new Date(agora.getTime() - JANELA_MOVIMENTACOES_MS);

  const { data: atividades, error: e1 } = await db
    .from("crm_lead_activities")
    .select("id, lead_id, reason, performed_at")
    .eq("organization_id", pedido.organizationId)
    .eq("type", "stage_changed")
    .gte("performed_at", desde.toISOString())
    .order("performed_at", { ascending: false })
    .limit(limite);
  if (e1) throw new Error(e1.message);

  const rows = (atividades ?? []) as Atividade[];
  if (rows.length === 0) return [];

  const ids = [...new Set(rows.map((a) => a.lead_id))];
  const { data: leads, error: e2 } = await db
    .from("crm_leads")
    .select("id, title, owner_user_id")
    .eq("organization_id", pedido.organizationId)
    .in("id", ids);
  if (e2) throw new Error(e2.message);

  const porId = new Map(((leads ?? []) as Lead[]).map((l) => [l.id, l]));
  return rows
    .map((a) => {
      const lead = porId.get(a.lead_id) ?? null;
      if (pedido.soDoDono && lead?.owner_user_id !== pedido.userId) return null;
      return montarMovimentacao(a, lead);
    })
    .filter((m): m is MovimentacaoDoFunil => m !== null);
}
