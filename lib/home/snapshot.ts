/**
 * Snapshot da Home — compõe motores existentes. Sem warehouse.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { agregarMetricas } from "@/lib/campanhas/metricas";
import { ehAcaoDeHoje } from "@/lib/comercial/proxima-acao";
import {
  listarProximasAcoes,
  type ProximaAcaoLinha,
} from "@/lib/demandas/listar-proximas-acoes";
import { carregarRosterDeAtendimento, podeAssumirAgora } from "@/lib/escalacao/atendentes";
import { carregaRadarDeRisco } from "@/lib/leads/radar-de-risco";
import { logger } from "@/lib/logger";
import { getQueueStatus } from "@/lib/routing/queue";
import { CONVERSATION_QUEUE_STATUSES, CONVERSATION_TERMINAL_STATUSES } from "@/lib/schemas";
import { carregarKpisDeSupervisao } from "@/lib/supervisao/kpis";
import { janelaDoPeriodo, type PeriodoPronto } from "@/lib/supervisao/periodo";

import {
  ehGestor,
  type AcaoDaHome,
  type SnapshotDaHome,
  type SnapshotPessoal,
} from "./tipos";

export interface PedidoDoSnapshot {
  organizationId: string;
  userId: string;
  role: string;
  periodo: PeriodoPronto;
  agora?: Date;
  /** Só manager: roster com nomes. Agent nunca recebe. */
  admin?: SupabaseClient | null;
}

function linhaParaAcao(a: ProximaAcaoLinha): AcaoDaHome {
  return {
    demanda_id: a.demanda_id,
    contact_id: a.contact_id,
    lead_id: a.lead_id,
    conversation_id: a.conversation_id,
    texto: a.texto,
    em: a.em,
    contact_name: a.contact_name,
    lead_title: a.lead_title,
    temperatura: a.temperatura,
    estado: a.estado,
    quando: a.quando,
    atraso: a.atraso,
  };
}

function vazioPessoal(): SnapshotPessoal {
  return {
    atrasadas: 0,
    hoje: 0,
    quentes_sem_acao: 0,
    conversas_minhas: 0,
    acoes: [],
    compromissos: [],
  };
}

async function fonte<T>(nome: string, fn: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    logger.warn("home.snapshot.fonte", {
      fonte: nome,
      erro: err instanceof Error ? err.message : "falha",
    });
    return { ok: false };
  }
}

export async function carregarSnapshotDaHome(
  db: SupabaseClient,
  pedido: PedidoDoSnapshot,
): Promise<SnapshotDaHome> {
  const t0 = Date.now();
  const agora = pedido.agora ?? new Date();
  const gestor = ehGestor(pedido.role);
  const { from, to } = janelaDoPeriodo(pedido.periodo, agora);
  const owner = gestor ? undefined : pedido.userId;

  const acoesP = fonte("demandas", () =>
    listarProximasAcoes(db, {
      organizationId: pedido.organizationId,
      visao: "todas",
      ownerUserId: owner,
      agora,
    }),
  );
  const countsP = fonte("conversas", async () => {
    const base = () =>
      db.from("conversations").select("id", { count: "exact", head: true }).eq(
        "organization_id",
        pedido.organizationId,
      );
    const [mine, unassigned] = await Promise.all([
      base()
        .eq("assigned_to_user_id", pedido.userId)
        .not("status", "in", `(${CONVERSATION_TERMINAL_STATUSES.join(",")})`),
      base().is("assigned_to_user_id", null).in("status", [...CONVERSATION_QUEUE_STATUSES]),
    ]);
    if (mine.error) throw new Error(mine.error.message);
    if (unassigned.error) throw new Error(unassigned.error.message);
    return { mine: mine.count ?? 0, unassigned: unassigned.count ?? 0 };
  });
  const agendaP = fonte("agenda", async () => {
    const inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000);
    let q = db
      .from("calendar_appointments")
      .select("id, title, starts_at, owner_user_id, status")
      .eq("organization_id", pedido.organizationId)
      .gte("starts_at", inicio.toISOString())
      .lt("starts_at", fim.toISOString())
      .order("starts_at", { ascending: true })
      .limit(5);
    if (!gestor) q = q.eq("owner_user_id", pedido.userId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ id: string; title: string | null; starts_at: string; status: string }>)
      .filter((a) => a.status !== "cancelled" && a.status !== "completed" && a.status !== "no_show")
      .map((a) => ({ id: a.id, title: a.title?.trim() || "Compromisso", starts_at: a.starts_at }));
  });
  const funilP = fonte("funil", async () => {
    if (gestor) {
      const kpis = await carregarKpisDeSupervisao(db, {
        organizationId: pedido.organizationId,
        from,
        to,
      });
      return { via: "kpis" as const, kpis };
    }
    const { data: stages, error: e1 } = await db
      .from("crm_stages")
      .select("id, name, position, pipeline_id, is_won, is_lost, is_archived")
      .eq("organization_id", pedido.organizationId)
      .eq("is_archived", false)
      .order("position", { ascending: true });
    if (e1) throw new Error(e1.message);
    const { data: leads, error: e2 } = await db
      .from("crm_leads")
      .select("stage_id, value_cents, pipeline_id")
      .eq("organization_id", pedido.organizationId)
      .eq("status", "open")
      .eq("owner_user_id", pedido.userId);
    if (e2) throw new Error(e2.message);
    const valorPor: Record<string, { count: number; value_cents: number }> = {};
    for (const l of (leads ?? []) as Array<{ stage_id: string; value_cents: number | null }>) {
      const cur = valorPor[l.stage_id] ?? { count: 0, value_cents: 0 };
      cur.count += 1;
      cur.value_cents += l.value_cents ?? 0;
      valorPor[l.stage_id] = cur;
    }
    const funil = ((stages ?? []) as Array<{
      id: string;
      name: string;
      pipeline_id: string;
      is_won: boolean;
      is_lost: boolean;
    }>)
      .filter((s) => !s.is_won && !s.is_lost)
      .map((s) => ({
        stage_id: s.id,
        stage_name: s.name,
        pipeline_id: s.pipeline_id,
        count: valorPor[s.id]?.count ?? 0,
        value_cents: valorPor[s.id]?.value_cents ?? 0,
      }));
    return { via: "mine" as const, funil };
  });

  const [acoesF, countsF, agendaF, funilF] = await Promise.all([acoesP, countsP, agendaP, funilP]);

  let personal = vazioPessoal();
  let personalOk: "ok" | "error" = "ok";
  if (acoesF.ok) {
    const todas = acoesF.data;
    const minhas = gestor
      ? todas.filter((a) => a.dono_user_id === pedido.userId)
      : todas;
    const atrasadas = todas.filter((a) => a.estado === "atrasada");
    const hoje = todas.filter((a) => ehAcaoDeHoje(a.em, agora));
    const quentes = todas.filter((a) => a.estado === "sem" && a.temperatura === "quente");
    const listaFonte = minhas.length > 0 ? minhas : todas;
    const atrasadasLista = listaFonte
      .filter((a) => a.estado === "atrasada")
      .sort((a, b) => new Date(b.em ?? 0).getTime() - new Date(a.em ?? 0).getTime());
    const hojeLista = listaFonte.filter(
      (a) => ehAcaoDeHoje(a.em, agora) && a.estado !== "atrasada",
    );
    const vagasHoje = Math.min(hojeLista.length, 4);
    const vagasAtrasadas = Math.min(atrasadasLista.length, Math.max(1, 5 - vagasHoje));
    const lista = [...atrasadasLista.slice(0, vagasAtrasadas), ...hojeLista.slice(0, vagasHoje)];
    personal = {
      atrasadas: atrasadas.length,
      hoje: hoje.length,
      quentes_sem_acao: quentes.length,
      conversas_minhas: countsF.ok ? countsF.data.mine : 0,
      acoes: lista.map(linhaParaAcao),
      compromissos: agendaF.ok ? agendaF.data : [],
    };
    if (!countsF.ok) personalOk = "error";
  } else {
    personalOk = "error";
    if (countsF.ok) personal.conversas_minhas = countsF.data.mine;
    if (agendaF.ok) personal.compromissos = agendaF.data;
  }

  let team: SnapshotDaHome["team"] = null;
  let commercial: SnapshotDaHome["commercial"] = null;
  let campaigns: SnapshotDaHome["campaigns"] = null;
  let teamSrc: SnapshotDaHome["sources"]["team"] = "omit";
  let commercialSrc: SnapshotDaHome["sources"]["commercial"] = "omit";
  let campaignsSrc: SnapshotDaHome["sources"]["campaigns"] = "omit";

  let funnel: SnapshotDaHome["funnel"] = [];
  let funnelSrc: SnapshotDaHome["sources"]["funnel"] = "ok";
  let pipelineHref = "/app/kanban";
  if (funilF.ok) {
    if (funilF.data.via === "kpis") {
      funnel = funilF.data.kpis.funil;
      const k = funilF.data.kpis;
      commercial = {
        leads_novos: k.comercial.leads_novos,
        oportunidades_abertas: k.comercial.oportunidades_abertas,
        ganhos: k.comercial.ganhos,
        perdidos: k.comercial.perdidos,
        conversao: k.comercial.conversao,
        sem_proxima_acao: k.comercial.sem_proxima_acao,
        atrasadas: k.comercial.atrasadas,
        paradas: null,
        vs_anterior: null,
      };
      commercialSrc = "ok";
      team = {
        fila: k.atendimento.fila,
        espera_mais_antiga_s: k.atendimento.espera_mais_antiga_s,
        primeira_resposta_media_s: k.atendimento.primeira_resposta_media_s,
        conversas_abertas: k.atendimento.conversas_abertas,
        disponiveis: 0,
        pessoas: [],
      };
      teamSrc = "ok";
    } else {
      funnel = funilF.data.funil;
    }
    const comPipeline = funnel.find((e) => e.pipeline_id);
    if (comPipeline) pipelineHref = `/app/pipelines/${comPipeline.pipeline_id}`;
  } else {
    funnelSrc = "error";
  }

  if (gestor) {
    const extras = await Promise.all([
      fonte("fila", () => getQueueStatus(db, pedido.organizationId, agora)),
      fonte("radar", () =>
        carregaRadarDeRisco(db, { organizationId: pedido.organizationId, limit: 50, now: agora }),
      ),
      fonte("campanha", async () => {
        const { data, error } = await db
          .from("campaigns")
          .select("id, name, started_at, status")
          .eq("organization_id", pedido.organizationId)
          .in("status", ["running", "completed"])
          .order("started_at", { ascending: false, nullsFirst: false })
          .limit(1);
        if (error) throw new Error(error.message);
        const camp = (data ?? [])[0] as { id: string; name: string } | undefined;
        if (!camp) return null;
        const { data: recs, error: e2 } = await db
          .from("campaign_recipients")
          .select("status, lead_id")
          .eq("organization_id", pedido.organizationId)
          .eq("campaign_id", camp.id);
        if (e2) throw new Error(e2.message);
        const m = agregarMetricas((recs ?? []) as Array<{ status: string; lead_id: string | null }>);
        return {
          id: camp.id,
          name: camp.name,
          enviados: m.enviadas,
          respostas: m.respondidas,
          opt_outs: m.opt_outs,
        };
      }),
      fonte("kpis_anterior", async () => {
        const duracao = to.getTime() - from.getTime();
        return carregarKpisDeSupervisao(db, {
          organizationId: pedido.organizationId,
          from: new Date(from.getTime() - duracao),
          to: from,
        });
      }),
      fonte("roster", async () => {
        if (!pedido.admin) return [];
        const roster = await carregarRosterDeAtendimento(pedido.admin, pedido.organizationId);
        const pessoas = await Promise.all(
          roster.slice(0, 8).map(async (r) => {
            let nome = `Atendente ${r.userId.slice(0, 8)}`;
            try {
              const { data } = await pedido.admin!.auth.admin.getUserById(r.userId);
              const full = data.user?.user_metadata?.full_name;
              if (typeof full === "string" && full.trim()) nome = full.trim();
            } catch {
              /* nome genérico */
            }
            return {
              user_id: r.userId,
              nome,
              disponivel: podeAssumirAgora(r, agora) || r.disponivel,
              abertas: r.cargaAtual,
            };
          }),
        );
        return pessoas;
      }),
    ]);

    const [filaF, radarF, campF, antF, rosterF] = extras;
    if (filaF.ok && team) {
      team.fila = filaF.data.queue_size;
      team.espera_mais_antiga_s = filaF.data.oldest_wait_seconds;
    } else if (!funilF.ok && filaF.ok) {
      team = {
        fila: filaF.data.queue_size,
        espera_mais_antiga_s: filaF.data.oldest_wait_seconds,
        primeira_resposta_media_s: null,
        conversas_abertas: 0,
        disponiveis: 0,
        pessoas: [],
      };
      teamSrc = "ok";
    } else if (teamSrc === "ok" && !filaF.ok) {
      teamSrc = "error";
    }

    if (radarF.ok && commercial) {
      commercial.paradas = radarF.data.total;
    } else if (commercial && !radarF.ok) {
      commercialSrc = "error";
    }

    if (antF.ok && commercial) {
      commercial.vs_anterior = {
        leads_novos: antF.data.comercial.leads_novos,
        ganhos: antF.data.comercial.ganhos,
        conversao: antF.data.comercial.conversao,
        primeira_resposta_media_s: antF.data.atendimento.primeira_resposta_media_s,
      };
    }

    if (campF.ok) {
      campaigns = campF.data;
      campaignsSrc = "ok";
    } else {
      campaignsSrc = "error";
    }

    if (rosterF.ok && team) {
      team.pessoas = rosterF.data;
      team.disponiveis = rosterF.data.filter((p) => p.disponivel).length;
    }
  }

  const elapsed = Date.now() - t0;
  logger.info("home.snapshot", {
    organizationId: pedido.organizationId,
    papel: gestor ? "manager" : "agent",
    ms: elapsed,
    fontes: {
      personal: personalOk,
      team: teamSrc,
      commercial: commercialSrc,
      funnel: funnelSrc,
      campaigns: campaignsSrc,
    },
  });

  return {
    periodo: pedido.periodo,
    papel: gestor ? "manager" : "agent",
    personal,
    team: gestor ? team : null,
    commercial: gestor ? commercial : null,
    funnel,
    campaigns: gestor ? campaigns : null,
    pipeline_href: pipelineHref,
    sources: {
      personal: personalOk,
      team: gestor ? teamSrc : "omit",
      commercial: gestor ? commercialSrc : "omit",
      funnel: funnelSrc,
      campaigns: gestor ? campaignsSrc : "omit",
    },
    elapsed_ms: elapsed,
  };
}
