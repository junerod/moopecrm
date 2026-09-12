/**
 * Supervisão operacional — agrega fontes JÁ existentes.
 * Sem warehouse, sem métrica que o backend não mede.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { agregarMetricas } from "@/lib/campanhas/metricas";
import { getQueueStatus } from "@/lib/routing/queue";
import { CONVERSATION_TERMINAL_STATUSES } from "@/lib/schemas";

export interface KpisDeSupervisao {
  atendimento: {
    fila: number;
    espera_mais_antiga_s: number;
    primeira_resposta_media_s: number | null;
    conversas_abertas: number;
    conversas_por_atendente: Array<{ user_id: string; abertas: number }>;
  };
  comercial: {
    leads_novos: number;
    oportunidades_abertas: number;
    sem_proxima_acao: number;
    atrasadas: number;
    ganhos: number;
    perdidos: number;
    conversao: number | null;
  };
  funil: Array<{
    stage_id: string;
    stage_name: string;
    count: number;
    value_cents: number;
  }>;
  campanhas: {
    executadas: number;
    enviados: number;
    respostas: number;
    leads_associados: number;
    opt_outs: number;
  };
  atendentes: Array<{
    user_id: string;
    conversas: number;
    primeira_resposta_s: number | null;
    resolvidas: number;
    leads: number;
    ganhos: number;
    atrasadas: number;
  }>;
}

export async function carregarKpisDeSupervisao(
  db: SupabaseClient,
  entrada: { organizationId: string; from: Date; to: Date },
): Promise<KpisDeSupervisao> {
  const { organizationId: org, from, to } = entrada;
  const fromIso = from.toISOString();
  const toIso = to.toISOString();

  const fila = await getQueueStatus(db, org, to);

  const { data: rpc } = await db.rpc("fn_attendant_metrics", {
    p_org: org,
    p_from: fromIso,
    p_to: toIso,
    p_owner: null,
  });
  const attendants = ((rpc as { attendants?: Array<{
    user_id: string;
    won: number;
    lost: number;
    conversations_handled: number;
    avg_first_response_seconds: number | null;
  }> } | null)?.attendants ?? []);

  const comResposta = attendants.filter((a) => a.avg_first_response_seconds != null);
  const primeira =
    comResposta.length === 0
      ? null
      : comResposta.reduce((acc, a) => acc + (a.avg_first_response_seconds ?? 0), 0)
        / comResposta.length;

  const { count: abertas } = await db
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org)
    .eq("status", "open");

  const { data: porDono } = await db
    .from("conversations")
    .select("assigned_to_user_id")
    .eq("organization_id", org)
    .eq("status", "open")
    .not("assigned_to_user_id", "is", null);

  const convPor: Record<string, number> = {};
  for (const r of (porDono ?? []) as Array<{ assigned_to_user_id: string | null }>) {
    if (!r.assigned_to_user_id) continue;
    convPor[r.assigned_to_user_id] = (convPor[r.assigned_to_user_id] ?? 0) + 1;
  }

  const { count: leadsNovos } = await db
    .from("crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org)
    .gte("created_at", fromIso)
    .lte("created_at", toIso);

  const { count: abertos } = await db
    .from("crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org)
    .eq("status", "open");

  const { data: demandas } = await db
    .from("demandas")
    .select("id, proximo_passo, proximo_passo_em, dono_user_id, fechada_em")
    .eq("organization_id", org)
    .is("fechada_em", null);

  let semPasso = 0;
  let atrasadas = 0;
  const atrasadasPor: Record<string, number> = {};
  for (const d of (demandas ?? []) as Array<{
    proximo_passo: string | null;
    proximo_passo_em: string | null;
    dono_user_id: string | null;
  }>) {
    if (!d.proximo_passo) semPasso += 1;
    if (d.proximo_passo_em && new Date(d.proximo_passo_em).getTime() < to.getTime()) {
      atrasadas += 1;
      if (d.dono_user_id) {
        atrasadasPor[d.dono_user_id] = (atrasadasPor[d.dono_user_id] ?? 0) + 1;
      }
    }
  }

  const { count: ganhos } = await db
    .from("crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org)
    .eq("status", "won")
    .gte("closed_at", fromIso)
    .lte("closed_at", toIso);

  const { count: perdidos } = await db
    .from("crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org)
    .eq("status", "lost")
    .gte("closed_at", fromIso)
    .lte("closed_at", toIso);

  const g = ganhos ?? 0;
  const p = perdidos ?? 0;
  const conversao = g + p === 0 ? null : g / (g + p);

  const { data: stages } = await db
    .from("crm_stages")
    .select("id, name, position, pipeline_id, is_won, is_lost, is_archived")
    .eq("organization_id", org)
    .eq("is_archived", false)
    .order("position", { ascending: true });

  const { data: leadsAbertos } = await db
    .from("crm_leads")
    .select("stage_id, value_cents")
    .eq("organization_id", org)
    .eq("status", "open");

  const valorPor: Record<string, { count: number; value_cents: number }> = {};
  for (const l of (leadsAbertos ?? []) as Array<{ stage_id: string; value_cents: number | null }>) {
    const cur = valorPor[l.stage_id] ?? { count: 0, value_cents: 0 };
    cur.count += 1;
    cur.value_cents += l.value_cents ?? 0;
    valorPor[l.stage_id] = cur;
  }

  const funil = ((stages ?? []) as Array<{
    id: string;
    name: string;
    is_won: boolean;
    is_lost: boolean;
  }>)
    .filter((s) => !s.is_won && !s.is_lost)
    .map((s) => ({
      stage_id: s.id,
      stage_name: s.name,
      count: valorPor[s.id]?.count ?? 0,
      value_cents: valorPor[s.id]?.value_cents ?? 0,
    }));

  const { data: camps } = await db
    .from("campaigns")
    .select("id, status, started_at")
    .eq("organization_id", org)
    .in("status", ["running", "completed", "cancelled", "failed"]);

  const campanhasPeriodo = ((camps ?? []) as Array<{ id: string; started_at: string | null }>).filter(
    (c) => !c.started_at || (c.started_at >= fromIso && c.started_at <= toIso),
  );
  const campIds = campanhasPeriodo.map((c) => c.id);
  let campAgg = agregarMetricas([]);
  if (campIds.length > 0) {
    const { data: recs } = await db
      .from("campaign_recipients")
      .select("status, lead_id")
      .eq("organization_id", org)
      .in("campaign_id", campIds);
    campAgg = agregarMetricas((recs ?? []) as Array<{ status: string; lead_id: string | null }>);
  }

  const { data: resolvidas } = await db
    .from("conversations")
    .select("assigned_to_user_id")
    .eq("organization_id", org)
    .in("status", [...CONVERSATION_TERMINAL_STATUSES])
    .gte("status_changed_at", fromIso)
    .lte("status_changed_at", toIso);

  const resPor: Record<string, number> = {};
  for (const r of (resolvidas ?? []) as Array<{ assigned_to_user_id: string | null }>) {
    if (!r.assigned_to_user_id) continue;
    resPor[r.assigned_to_user_id] = (resPor[r.assigned_to_user_id] ?? 0) + 1;
  }

  const { data: leadsPorDono } = await db
    .from("crm_leads")
    .select("owner_user_id")
    .eq("organization_id", org)
    .gte("created_at", fromIso)
    .lte("created_at", toIso);

  const leadsPor: Record<string, number> = {};
  for (const l of (leadsPorDono ?? []) as Array<{ owner_user_id: string | null }>) {
    if (!l.owner_user_id) continue;
    leadsPor[l.owner_user_id] = (leadsPor[l.owner_user_id] ?? 0) + 1;
  }

  const atendentes = attendants.map((a) => ({
    user_id: a.user_id,
    conversas: a.conversations_handled,
    primeira_resposta_s: a.avg_first_response_seconds,
    resolvidas: resPor[a.user_id] ?? 0,
    leads: leadsPor[a.user_id] ?? 0,
    ganhos: a.won,
    atrasadas: atrasadasPor[a.user_id] ?? 0,
  }));

  return {
    atendimento: {
      fila: fila.queue_size,
      espera_mais_antiga_s: fila.oldest_wait_seconds,
      primeira_resposta_media_s: Number.isFinite(primeira) ? Math.round(primeira!) : null,
      conversas_abertas: abertas ?? 0,
      conversas_por_atendente: Object.entries(convPor).map(([user_id, n]) => ({
        user_id,
        abertas: n,
      })),
    },
    comercial: {
      leads_novos: leadsNovos ?? 0,
      oportunidades_abertas: abertos ?? 0,
      sem_proxima_acao: semPasso,
      atrasadas,
      ganhos: g,
      perdidos: p,
      conversao,
    },
    funil,
    campanhas: {
      executadas: campanhasPeriodo.length,
      enviados: campAgg.enviadas,
      respostas: campAgg.respondidas,
      leads_associados: campAgg.leads_associados,
      opt_outs: campAgg.opt_outs,
    },
    atendentes,
  };
}
