/**
 * O quadro do funil, lido e escrito pela mesma tabela que a tela do CRM.
 *
 * Service role bypassa RLS: organization_id sai do token, nunca do corpo.
 * Cada mudança grava timeline (`crm_lead_activities`) e audit. O CRM aberto
 * vê a linha nova porque é a mesma linha — não há fila para sincronizar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/api/types";
import { estadoDaProximaAcao } from "@/lib/comercial/proxima-acao";
import { idExternoDoContato } from "@/lib/moope/leitura";
import { rotuloDoContato, SEM_NOME } from "@/lib/contacts/rotulo-do-contato";
import { ACTIVITY_LABELS, type ActivityType } from "@/lib/leads/activity-vocabulary";
import { emitLeadActivity, stageChangeReason } from "@/lib/leads/activity-emitter";
import { registraFalhaDeAtividade } from "@/lib/leads/activity-write-failure";
import { encerraDemanda } from "@/lib/leads/encerramento";
import { logger } from "@/lib/logger";
import {
  horasNoEstagio,
  posicaoNoFim,
  temperaturaDoCard,
  vocabularioDoFunil,
  type CardDoQuadro,
  type EtapaDoQuadro,
  type FunilNaLista,
} from "@/lib/moope/funil-quadro";

const ATOR = { type: "webhook_source" as const, id: "facejus" };

export type FalhaDoQuadro = {
  ok: false;
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type Ok<T> = { ok: true; data: T };

type LeadLinha = {
  id: string;
  title: string;
  status: string;
  stage_id: string;
  pipeline_id: string;
  position_in_stage: number;
  value_cents: number | null;
  currency: string | null;
  temperatura: string | null;
  tags: string[] | null;
  updated_at: string;
  created_at: string;
  last_activity_at: string | null;
  contact_id: string | null;
  lost_reason: string | null;
  organization_id: string;
};

const COLUNAS_DO_LEAD =
  "id, title, status, stage_id, pipeline_id, position_in_stage, value_cents, currency, temperatura, tags, updated_at, created_at, last_activity_at, contact_id, lost_reason, organization_id";

export async function listarQuadros(
  db: SupabaseClient,
  orgId: string,
): Promise<FunilNaLista[]> {
  const { data, error } = await db
    .from("crm_pipelines")
    .select("id, name, is_default, vocabulary, position")
    .eq("organization_id", orgId)
    .eq("is_archived", false)
    .order("position");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    is_default: Boolean(p.is_default),
    vocabulary: vocabularioDoFunil(p.vocabulary),
  }));
}

export async function quadroDoFunil(
  db: SupabaseClient,
  orgId: string,
  pipelineId: string,
): Promise<Ok<{ pipeline: FunilNaLista; stages: EtapaDoQuadro[]; cards: CardDoQuadro[] }> | FalhaDoQuadro> {
  const { data: pipeline, error: erroFunil } = await db
    .from("crm_pipelines")
    .select("id, name, is_default, vocabulary, is_archived")
    .eq("id", pipelineId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (erroFunil) throw new Error(erroFunil.message);
  if (!pipeline || pipeline.is_archived) {
    return { ok: false, status: 404, code: "not_found", message: "Funil não encontrado." };
  }

  const { data: stages, error: erroEtapas } = await db
    .from("crm_stages")
    .select("id, name, position, color, is_won, is_lost")
    .eq("organization_id", orgId)
    .eq("pipeline_id", pipelineId)
    .eq("is_archived", false)
    .order("position");
  if (erroEtapas) throw new Error(erroEtapas.message);

  const leads = await leadsDoFunil(db, orgId, pipelineId);

  const linhas = (leads ?? []) as LeadLinha[];
  const contatos = await fichaDosContatos(
    db,
    orgId,
    [...new Set(linhas.map((l) => l.contact_id).filter((id): id is string => Boolean(id)))],
  );
  const passos = await passosAbertos(db, orgId);

  const cards = linhas.map((lead) =>
    projetarCard(lead, contatos.get(lead.contact_id ?? ""), passoDoLead(lead, passos)),
  );

  return {
    ok: true,
    data: {
      pipeline: {
        id: String(pipeline.id),
        name: String(pipeline.name),
        is_default: Boolean(pipeline.is_default),
        vocabulary: vocabularioDoFunil(pipeline.vocabulary),
      },
      stages: (stages ?? []).map((s) => ({
        id: String(s.id),
        name: String(s.name),
        position: Number(s.position),
        color: (s.color as string | null) ?? null,
        is_won: Boolean(s.is_won),
        is_lost: Boolean(s.is_lost),
      })),
      cards,
    },
  };
}

export async function moverCard(args: {
  db: SupabaseClient;
  orgId: string;
  pipelineId: string;
  leadId: string;
  stageId: string;
  expectedUpdatedAt: string;
  positionInStage?: number;
  requestId: string;
  tokenId: string;
}): Promise<Ok<Pick<CardDoQuadro, "id" | "stage_id" | "status" | "position_in_stage" | "updated_at">> | FalhaDoQuadro> {
  const lead = await buscarLead(args.db, args.orgId, args.pipelineId, args.leadId);
  if (!lead.ok) return lead;

  const { data: stage, error: erroEtapa } = await args.db
    .from("crm_stages")
    .select("id, name, pipeline_id")
    .eq("id", args.stageId)
    .eq("organization_id", args.orgId)
    .maybeSingle();
  if (erroEtapa) throw new Error(erroEtapa.message);
  if (!stage || stage.pipeline_id !== args.pipelineId) {
    return { ok: false, status: 404, code: "not_found", message: "Etapa não encontrada neste funil." };
  }

  const posicao =
    args.positionInStage ??
    (await posicaoNoFimDaEtapa(args.db, args.orgId, args.pipelineId, args.stageId));

  const { data: updated, error: erroUpdate } = await args.db
    .from("crm_leads")
    .update({
      stage_id: args.stageId,
      position_in_stage: posicao,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.leadId)
    .eq("organization_id", args.orgId)
    .eq("pipeline_id", args.pipelineId)
    .eq("updated_at", args.expectedUpdatedAt)
    .select(COLUNAS_DO_LEAD)
    .maybeSingle();
  if (erroUpdate) throw new Error(erroUpdate.message);
  if (!updated) {
    const { data: atual } = await args.db
      .from("crm_leads")
      .select("updated_at")
      .eq("id", args.leadId)
      .eq("organization_id", args.orgId)
      .maybeSingle();
    return {
      ok: false,
      status: 409,
      code: "lead_stage_changed_concurrent",
      message: "O card mudou enquanto você arrastava. Recarregue o funil.",
      details: { current_updated_at: atual?.updated_at ?? null },
    };
  }

  const fresco = updated as LeadLinha;
  const { data: origem } = await args.db
    .from("crm_stages")
    .select("name")
    .eq("id", lead.data.stage_id)
    .eq("organization_id", args.orgId)
    .maybeSingle();

  await registrarAtividade(args.db, {
    orgId: args.orgId,
    lead: fresco,
    type: "stage_changed",
    reason: `${stageChangeReason(origem?.name ?? null, String(stage.name))} pelo Facejus`,
    payload: {
      from_stage_id: lead.data.stage_id,
      to_stage_id: args.stageId,
      pipeline_id: args.pipelineId,
      origem: "facejus",
    },
    requestId: args.requestId,
  });

  await args.db.rpc("emit_event", {
    p_event_type: "lead.stage_changed",
    p_entity_kind: "crm_lead",
    p_entity_id: args.leadId,
    p_payload: {
      from_stage_id: lead.data.stage_id,
      to_stage_id: args.stageId,
      position_in_stage: posicao,
      status: fresco.status,
    },
    p_metadata: { request_id: args.requestId, actor_type: "facejus", actor_api_token_id: args.tokenId },
    p_organization_id: args.orgId,
  });

  await audit({
    action: "lead.moved",
    actorApiTokenId: args.tokenId,
    organizationId: args.orgId,
    resourceType: "crm_lead",
    resourceId: args.leadId,
    requestId: args.requestId,
    metadata: {
      from_stage_id: lead.data.stage_id,
      to_stage_id: args.stageId,
      position_in_stage: posicao,
      origem: "facejus",
    },
  });

  return {
    ok: true,
    data: {
      id: fresco.id,
      stage_id: fresco.stage_id,
      status: fresco.status,
      position_in_stage: Number(fresco.position_in_stage),
      updated_at: fresco.updated_at,
    },
  };
}

export async function ganharCard(args: {
  db: SupabaseClient;
  orgId: string;
  pipelineId: string;
  leadId: string;
  requestId: string;
}): Promise<Ok<{ id: string; status: string; updated_at: string | null }> | FalhaDoQuadro> {
  return encerrar({ ...args, desfecho: "won" });
}

export async function perderCard(args: {
  db: SupabaseClient;
  orgId: string;
  pipelineId: string;
  leadId: string;
  lostReason: string;
  requestId: string;
}): Promise<Ok<{ id: string; status: string; updated_at: string | null }> | FalhaDoQuadro> {
  return encerrar({ ...args, desfecho: "lost", motivo: args.lostReason });
}

export async function editarCard(args: {
  db: SupabaseClient;
  orgId: string;
  pipelineId: string;
  leadId: string;
  expectedUpdatedAt: string;
  title?: string;
  valueCents?: number | null;
  temperature?: "frio" | "morno" | "quente" | null;
  requestId: string;
  tokenId: string;
}): Promise<Ok<Pick<CardDoQuadro, "id" | "title" | "value_cents" | "temperature" | "updated_at">> | FalhaDoQuadro> {
  const lead = await buscarLead(args.db, args.orgId, args.pipelineId, args.leadId);
  if (!lead.ok) return lead;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (args.title !== undefined) patch.title = args.title;
  if (args.valueCents !== undefined) patch.value_cents = args.valueCents;
  if (args.temperature !== undefined) patch.temperatura = args.temperature;

  const { data: updated, error } = await args.db
    .from("crm_leads")
    .update(patch)
    .eq("id", args.leadId)
    .eq("organization_id", args.orgId)
    .eq("pipeline_id", args.pipelineId)
    .eq("updated_at", args.expectedUpdatedAt)
    .select(COLUNAS_DO_LEAD)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!updated) {
    return {
      ok: false,
      status: 409,
      code: "lead_stage_changed_concurrent",
      message: "O card mudou enquanto você editava. Recarregue o funil.",
    };
  }
  const fresco = updated as LeadLinha;
  await registrarAtividade(args.db, {
    orgId: args.orgId,
    lead: fresco,
    type: "note",
    reason: "Ficha atualizada pelo Facejus",
    payload: { origem: "facejus", campos: Object.keys(patch).filter((k) => k !== "updated_at") },
    requestId: args.requestId,
  });
  await audit({
    action: "lead.updated",
    actorApiTokenId: args.tokenId,
    organizationId: args.orgId,
    resourceType: "crm_lead",
    resourceId: args.leadId,
    requestId: args.requestId,
    metadata: { origem: "facejus", campos: Object.keys(patch) },
  });
  return {
    ok: true,
    data: {
      id: fresco.id,
      title: fresco.title,
      value_cents: fresco.value_cents,
      temperature: temperaturaDoCard(fresco.temperatura),
      updated_at: fresco.updated_at,
    },
  };
}

export async function marcarProximoPasso(args: {
  db: SupabaseClient;
  orgId: string;
  pipelineId: string;
  leadId: string;
  text: string;
  dueAt: string | null;
  requestId: string;
  tokenId: string;
}): Promise<Ok<{ text: string; due_at: string | null }> | FalhaDoQuadro> {
  const lead = await buscarLead(args.db, args.orgId, args.pipelineId, args.leadId);
  if (!lead.ok) return lead;
  if (!lead.data.contact_id) {
    return {
      ok: false,
      status: 422,
      code: "validation_failed",
      message: "Este negócio não tem cliente vinculado, então não dá para marcar o próximo passo.",
    };
  }
  if (lead.data.status !== "open") {
    return {
      ok: false,
      status: 422,
      code: "validation_failed",
      message: "Negócio encerrado não recebe próximo passo.",
    };
  }

  const agora = new Date().toISOString();
  const { data: existente, error: erroLeitura } = await args.db
    .from("demandas")
    .select("id")
    .eq("organization_id", args.orgId)
    .eq("contact_id", lead.data.contact_id)
    .is("fechada_em", null)
    .order("aberta_em", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (erroLeitura) throw new Error(erroLeitura.message);

  if (existente?.id) {
    const { error } = await args.db
      .from("demandas")
      .update({
        proximo_passo: args.text,
        proximo_passo_em: args.dueAt,
        lead_id: args.leadId,
        updated_at: agora,
      })
      .eq("id", existente.id)
      .eq("organization_id", args.orgId)
      .is("fechada_em", null);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await args.db.from("demandas").insert({
      organization_id: args.orgId,
      contact_id: lead.data.contact_id,
      lead_id: args.leadId,
      origem: "manual",
      estado: "em_atendimento",
      dono_kind: "ia",
      proximo_passo: args.text,
      proximo_passo_em: args.dueAt,
      updated_at: agora,
    });
    if (error) throw new Error(error.message);
  }

  await registrarAtividade(args.db, {
    orgId: args.orgId,
    lead: lead.data,
    type: "note",
    reason: `Próximo passo pelo Facejus: ${args.text}`,
    payload: { origem: "facejus", due_at: args.dueAt },
    requestId: args.requestId,
  });
  await audit({
    action: "lead.updated",
    actorApiTokenId: args.tokenId,
    organizationId: args.orgId,
    resourceType: "crm_lead",
    resourceId: args.leadId,
    requestId: args.requestId,
    metadata: { origem: "facejus", proximo_passo: true },
  });

  return { ok: true, data: { text: args.text, due_at: args.dueAt } };
}

export async function historicoDoCard(
  db: SupabaseClient,
  orgId: string,
  pipelineId: string,
  leadId: string,
): Promise<Ok<Array<{ type: string; label: string; reason: string; at: string }>> | FalhaDoQuadro> {
  const lead = await buscarLead(db, orgId, pipelineId, leadId);
  if (!lead.ok) return lead;
  const { data, error } = await db
    .from("crm_lead_activities")
    .select("type, reason, created_at")
    .eq("organization_id", orgId)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return {
    ok: true,
    data: (data ?? []).map((linha) => {
      const type = String(linha.type);
      const label = type in ACTIVITY_LABELS ? ACTIVITY_LABELS[type as ActivityType] : type;
      return {
        type,
        label,
        reason: String(linha.reason ?? ""),
        at: String(linha.created_at),
      };
    }),
  };
}

async function encerrar(args: {
  db: SupabaseClient;
  orgId: string;
  pipelineId: string;
  leadId: string;
  desfecho: "won" | "lost";
  motivo?: string;
  requestId: string;
}): Promise<Ok<{ id: string; status: string; updated_at: string | null }> | FalhaDoQuadro> {
  const lead = await buscarLead(args.db, args.orgId, args.pipelineId, args.leadId);
  if (!lead.ok) return lead;
  try {
    const { lead: fechado } = await encerraDemanda(
      args.db,
      {
        organization_id: args.orgId,
        actor: ATOR,
        requestId: args.requestId,
      },
      { leadId: args.leadId, desfecho: args.desfecho, motivo: args.motivo },
    );
    return {
      ok: true,
      data: {
        id: args.leadId,
        status: String(fechado.status ?? args.desfecho),
        updated_at: typeof fechado.updated_at === "string" ? fechado.updated_at : null,
      },
    };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, status: err.status, code: err.code, message: err.message };
    }
    throw err;
  }
}

async function buscarLead(
  db: SupabaseClient,
  orgId: string,
  pipelineId: string,
  leadId: string,
): Promise<Ok<LeadLinha> | FalhaDoQuadro> {
  const { data, error } = await db
    .from("crm_leads")
    .select(COLUNAS_DO_LEAD)
    .eq("id", leadId)
    .eq("organization_id", orgId)
    .eq("pipeline_id", pipelineId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || (data as LeadLinha).status === "archived") {
    return { ok: false, status: 404, code: "not_found", message: "Negócio não encontrado neste funil." };
  }
  return { ok: true, data: data as LeadLinha };
}

async function posicaoNoFimDaEtapa(
  db: SupabaseClient,
  orgId: string,
  pipelineId: string,
  stageId: string,
): Promise<number> {
  const { data, error } = await db
    .from("crm_leads")
    .select("position_in_stage")
    .eq("organization_id", orgId)
    .eq("pipeline_id", pipelineId)
    .eq("stage_id", stageId)
    .order("position_in_stage", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const ultima = data ? Number(data.position_in_stage) : null;
  return posicaoNoFim(Number.isFinite(ultima) ? ultima : null);
}

async function registrarAtividade(
  db: SupabaseClient,
  args: {
    orgId: string;
    lead: LeadLinha;
    type: ActivityType;
    reason: string;
    payload: Record<string, unknown>;
    requestId: string;
  },
): Promise<void> {
  const atividade = await emitLeadActivity(db, {
    organizationId: args.orgId,
    leadId: args.lead.id,
    contactId: args.lead.contact_id,
    type: args.type,
    sourceModule: "crm",
    sourceId: args.lead.id,
    actor: ATOR,
    reason: args.reason,
    payload: args.payload,
  });
  if (!atividade.ok) {
    await registraFalhaDeAtividade(db, {
      organizationId: args.orgId,
      leadId: args.lead.id,
      tipo: args.type,
      origem: "moope/funil-quadro",
      erro: atividade.error,
      requestId: args.requestId,
    });
    logger.warn("moope.funil.atividade", { erro: atividade.error });
  }
}

function projetarCard(
  lead: LeadLinha,
  contato: { externalId: string | null; nome: string | null; papel: string | null } | undefined,
  passo: { text: string; due_at: string | null } | null,
): CardDoQuadro {
  return {
    id: lead.id,
    title: lead.title,
    status: lead.status,
    stage_id: lead.stage_id,
    position_in_stage: Number(lead.position_in_stage),
    value_cents: lead.value_cents,
    currency: lead.currency,
    temperature: temperaturaDoCard(lead.temperatura),
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    updated_at: lead.updated_at,
    created_at: lead.created_at,
    last_activity_at: lead.last_activity_at,
    hours_in_stage: horasNoEstagio(lead.last_activity_at, lead.created_at),
    contact_external_id: contato?.externalId ?? null,
    contact_name: contato?.nome ?? null,
    papel: contato?.papel ?? null,
    lost_reason: lead.lost_reason,
    next_step: passo
      ? { text: passo.text, due_at: passo.due_at, state: estadoDaProximaAcao({ texto: passo.text, em: passo.due_at }) }
      : null,
  };
}

async function leadsDoFunil(db: SupabaseClient, orgId: string, pipelineId: string): Promise<LeadLinha[]> {
  const pagina = 500;
  const linhas: LeadLinha[] = [];
  for (let from = 0; ; from += pagina) {
    const { data, error } = await db
      .from("crm_leads")
      .select(COLUNAS_DO_LEAD)
      .eq("organization_id", orgId)
      .eq("pipeline_id", pipelineId)
      .neq("status", "archived")
      .order("position_in_stage")
      .range(from, from + pagina - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as LeadLinha[];
    linhas.push(...lote);
    if (lote.length < pagina) return linhas;
  }
}

async function fichaDosContatos(
  db: SupabaseClient,
  orgId: string,
  ids: string[],
): Promise<Map<string, { externalId: string | null; nome: string | null; papel: string | null }>> {
  const mapa = new Map<string, { externalId: string | null; nome: string | null; papel: string | null }>();
  const loteDe = 40;
  for (let i = 0; i < ids.length; i += loteDe) {
    const { data, error } = await db
      .from("contacts")
      .select("id, display_name, name, papel, source_metadata")
      .eq("organization_id", orgId)
      .in("id", ids.slice(i, i + loteDe));
    if (error) throw new Error(error.message);
    for (const c of data ?? []) {
      const rotulo = rotuloDoContato({ display_name: c.display_name, name: c.name });
      mapa.set(String(c.id), {
        externalId: idExternoDoContato(c.source_metadata),
        nome: rotulo === SEM_NOME ? null : rotulo,
        papel: typeof c.papel === "string" ? c.papel : null,
      });
    }
  }
  return mapa;
}

type PassoAberto = { lead_id: string | null; contact_id: string | null; text: string; due_at: string | null };

async function passosAbertos(db: SupabaseClient, orgId: string): Promise<PassoAberto[]> {
  const { data, error } = await db
    .from("demandas")
    .select("lead_id, contact_id, proximo_passo, proximo_passo_em")
    .eq("organization_id", orgId)
    .is("fechada_em", null)
    .not("proximo_passo", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((d) => ({
      lead_id: (d.lead_id as string | null) ?? null,
      contact_id: (d.contact_id as string | null) ?? null,
      text: String(d.proximo_passo ?? "").trim(),
      due_at: (d.proximo_passo_em as string | null) ?? null,
    }))
    .filter((d) => d.text.length > 0);
}

function passoDoLead(lead: LeadLinha, passos: PassoAberto[]): { text: string; due_at: string | null } | null {
  const peloLead = passos.find((p) => p.lead_id === lead.id);
  if (peloLead) return { text: peloLead.text, due_at: peloLead.due_at };
  if (!lead.contact_id) return null;
  const peloContato = passos.find((p) => !p.lead_id && p.contact_id === lead.contact_id);
  return peloContato ? { text: peloContato.text, due_at: peloContato.due_at } : null;
}
