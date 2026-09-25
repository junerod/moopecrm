/**
 * Clone canônico entre funis (P-01): cria lead no destino e fecha origem como lost.
 * NUNCA altera `pipeline_id` da linha original.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { HandlerCtx } from "@/lib/api/handlers/types";
import { ApiError } from "@/lib/api/types";
import { audit } from "@/lib/audit";
import { createLeadHandler } from "@/app/api/v1/leads/_handler";
import { encerraDemanda } from "@/lib/leads/encerramento";
import { emitLeadActivity } from "@/lib/leads/activity-emitter";
import { registraFalhaDeAtividade } from "@/lib/leads/activity-write-failure";
import { LOST_REASON_MOVED_TO_PIPELINE } from "@/lib/pipelines/funil-suporte";

export interface TransferPipelineInput {
  leadId: string;
  targetPipelineId: string;
  /** Se omitido, usa a primeira etapa aberta (não won/lost) do funil destino. */
  targetStageId?: string | null;
}

export interface TransferPipelineResult {
  origin_lead_id: string;
  new_lead_id: string;
  target_pipeline_id: string;
  target_stage_id: string;
}

export async function transferLeadToPipeline(
  supabase: SupabaseClient,
  ctx: HandlerCtx,
  input: TransferPipelineInput,
): Promise<TransferPipelineResult> {
  const { data: lead, error: leadErr } = await supabase
    .from("crm_leads")
    .select("*")
    .eq("id", input.leadId)
    .eq("organization_id", ctx.organization_id)
    .maybeSingle();

  if (leadErr) {
    throw new ApiError(500, "internal_error", undefined, ctx.requestId, leadErr.message);
  }
  if (!lead) {
    throw new ApiError(404, "not_found", undefined, ctx.requestId, "Lead não encontrado.");
  }

  if ((lead as { pipeline_id: string }).pipeline_id === input.targetPipelineId) {
    throw new ApiError(
      422,
      "unprocessable_entity",
      undefined,
      ctx.requestId,
      "O card já está neste funil. Use Mover para… para mudar de etapa.",
    );
  }

  if ((lead as { status: string }).status !== "open") {
    throw new ApiError(
      422,
      "unprocessable_entity",
      undefined,
      ctx.requestId,
      "Só dá para enviar um card aberto para outro funil.",
    );
  }

  const { data: targetPipe, error: pipeErr } = await supabase
    .from("crm_pipelines")
    .select("id, name, is_archived")
    .eq("id", input.targetPipelineId)
    .eq("organization_id", ctx.organization_id)
    .maybeSingle();

  if (pipeErr) {
    throw new ApiError(500, "internal_error", undefined, ctx.requestId, pipeErr.message);
  }
  if (!targetPipe || targetPipe.is_archived) {
    throw new ApiError(404, "not_found", undefined, ctx.requestId, "Funil destino não encontrado.");
  }

  let stageId = input.targetStageId ?? null;
  if (stageId) {
    const { data: stage, error: stErr } = await supabase
      .from("crm_stages")
      .select("id, pipeline_id, is_won, is_lost, is_archived")
      .eq("id", stageId)
      .eq("organization_id", ctx.organization_id)
      .maybeSingle();
    if (stErr) {
      throw new ApiError(500, "internal_error", undefined, ctx.requestId, stErr.message);
    }
    if (!stage || stage.pipeline_id !== input.targetPipelineId) {
      throw new ApiError(
        422,
        "stage_pipeline_mismatch",
        undefined,
        ctx.requestId,
        "A etapa não pertence ao funil destino.",
      );
    }
    if (stage.is_archived) {
      throw new ApiError(422, "stage_archived", undefined, ctx.requestId, "Etapa arquivada.");
    }
  } else {
    const { data: primeira, error: stErr } = await supabase
      .from("crm_stages")
      .select("id")
      .eq("pipeline_id", input.targetPipelineId)
      .eq("organization_id", ctx.organization_id)
      .eq("is_archived", false)
      .eq("is_won", false)
      .eq("is_lost", false)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (stErr) {
      throw new ApiError(500, "internal_error", undefined, ctx.requestId, stErr.message);
    }
    if (!primeira) {
      throw new ApiError(
        422,
        "unprocessable_entity",
        undefined,
        ctx.requestId,
        "O funil destino não tem etapa aberta para receber o card.",
      );
    }
    stageId = (primeira as { id: string }).id;
  }

  const origem = lead as {
    id: string;
    title: string;
    description: string | null;
    contact_id: string | null;
    value_cents: number | null;
    currency: string | null;
    tags: string[] | null;
    source: string;
    owner_user_id: string | null;
    owner_agent_id: string | null;
    custom_fields: Record<string, unknown> | null;
    pipeline_id: string;
  };

  const novo = await createLeadHandler(supabase, ctx, {
    pipeline_id: input.targetPipelineId,
    stage_id: stageId!,
    title: origem.title,
    description: origem.description,
    contact_id: origem.contact_id ?? undefined,
    value_cents: origem.value_cents ?? undefined,
    currency: origem.currency ?? "BRL",
    tags: origem.tags ?? [],
    source: origem.source || "transfer",
    owner_user_id: origem.owner_user_id,
    owner_agent_id: origem.owner_agent_id,
    custom_fields: origem.custom_fields ?? undefined,
    source_metadata: {
      transferred_from_lead_id: origem.id,
      transferred_from_pipeline_id: origem.pipeline_id,
    },
  });

  const newLeadId = (novo as { id: string }).id;

  await encerraDemanda(supabase, ctx, {
    leadId: origem.id,
    desfecho: "lost",
    motivo: LOST_REASON_MOVED_TO_PIPELINE,
  });

  const atividade = await emitLeadActivity(supabase, {
    organizationId: ctx.organization_id,
    leadId: origem.id,
    contactId: origem.contact_id,
    type: "note",
    sourceModule: "crm",
    sourceId: origem.id,
    actor: ctx.actor,
    reason: `Enviado para o funil «${(targetPipe as { name: string }).name}»`,
    payload: {
      transferred_to_lead_id: newLeadId,
      transferred_to_pipeline_id: input.targetPipelineId,
      transferred_to_stage_id: stageId,
    },
  });
  if (!atividade.ok) {
    await registraFalhaDeAtividade(supabase, {
      organizationId: ctx.organization_id,
      leadId: origem.id,
      tipo: "note",
      origem: "leads/transfer-pipeline",
      erro: atividade.error,
      requestId: ctx.requestId,
    });
  }

  const actorUserId = ctx.actor.type === "user" ? ctx.actor.id : null;
  await audit({
    action: "lead.transferred_pipeline",
    actorUserId,
    organizationId: ctx.organization_id,
    resourceType: "crm_lead",
    resourceId: origem.id,
    requestId: ctx.requestId,
    metadata: {
      new_lead_id: newLeadId,
      target_pipeline_id: input.targetPipelineId,
      target_stage_id: stageId,
      from_pipeline_id: origem.pipeline_id,
    },
  });

  return {
    origin_lead_id: origem.id,
    new_lead_id: newLeadId,
    target_pipeline_id: input.targetPipelineId,
    target_stage_id: stageId!,
  };
}
