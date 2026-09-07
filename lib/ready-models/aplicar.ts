/**
 * Instalador genérico de Ready Model.
 *
 * Recebe DADO (definition). Não ramifica por locação/advocacia/comercial.
 * Depois da cópia o tenant é dono — reaplicar o mesmo id+version+subtype é no-op.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { publishFollowupFlowVersion } from "@/lib/followup/publish";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";
import type { FlowGraph } from "@/lib/followup/graph-schema";
import { garantirQuadroComoPadrao } from "@/lib/onboarding/garantir-quadro";
import {
  lerPerfilDoNegocio,
  mesmoPerfilAplicado,
  montarBlocoPerfil,
  CHAVE_PERFIL,
} from "@/lib/ready-models/perfil";
import type {
  OpcoesDoInstalador,
  ReadyModelDefinition,
  ResultadoDoReadyModel,
} from "@/lib/ready-models/tipos";

export async function aplicarReadyModel(
  admin: SupabaseClient,
  orgId: string,
  definition: ReadyModelDefinition,
  options: OpcoesDoInstalador,
): Promise<ResultadoDoReadyModel> {
  const settings = await lerSettings(admin, orgId);
  const gravado = lerPerfilDoNegocio(settings);
  const noopPadrao = options.noopSeJaAplicado !== false;

  if (
    noopPadrao &&
    mesmoPerfilAplicado(gravado, definition.id, definition.version, definition.subtype)
  ) {
    const pipelinePadraoId = await idDoQuadroPadrao(admin, orgId);
    let followupId: string | null = null;
    let criouFollowup = false;
    if (options.followup && definition.followup) {
      const f = await garantirFollowup(admin, orgId, definition, options.actorUserId ?? null);
      followupId = f.id;
      criouFollowup = f.criou;
    }
    if (criouFollowup) {
      return {
        ok: true,
        noop: false,
        perfil: gravado ?? montarBlocoPerfil(definition.id, definition.version, definition.subtype),
        pipelinePadraoId,
        criouQuadroNovo: false,
        artifacts: { automation_rule_id: null, followup_pointer_id: followupId },
      };
    }
    return {
      ok: true,
      noop: true,
      perfil: gravado ?? montarBlocoPerfil(definition.id, definition.version, definition.subtype),
      pipelinePadraoId,
      criouQuadroNovo: false,
    };
  }

  const proposta = options.pipelineOverride ?? definition.pipeline;
  const quadro = await garantirQuadroComoPadrao(admin, orgId, proposta);
  await gravarSettingsDoQuadro(admin, orgId, quadro.id, definition);
  const automationId = await garantirAutomacao(admin, orgId, definition, options.actorUserId ?? null);
  const followup =
    options.followup && definition.followup
      ? await garantirFollowup(admin, orgId, definition, options.actorUserId ?? null)
      : null;
  const followupId = followup?.id ?? null;

  const perfil = montarBlocoPerfil(definition.id, definition.version, definition.subtype);
  await gravarPerfil(admin, orgId, settings, perfil);

  return {
    ok: true,
    noop: false,
    perfil,
    pipelinePadraoId: quadro.id,
    criouQuadroNovo: quadro.criou,
    artifacts: {
      automation_rule_id: automationId,
      followup_pointer_id: followupId,
    },
  };
}

async function lerSettings(
  admin: SupabaseClient,
  orgId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(`ler settings: ${error.message}`);
  const raw = data?.settings;
  return raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
}

async function idDoQuadroPadrao(admin: SupabaseClient, orgId: string): Promise<string> {
  const { data, error } = await admin
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  if (error || !data) throw new Error(`sem funil padrão: ${error?.message ?? "não achei"}`);
  return (data as { id: string }).id;
}

async function gravarSettingsDoQuadro(
  admin: SupabaseClient,
  orgId: string,
  pipelineId: string,
  definition: ReadyModelDefinition,
): Promise<void> {
  const { data, error } = await admin
    .from("crm_pipelines")
    .select("settings, vocabulary")
    .eq("id", pipelineId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (error) throw new Error(`ler quadro: ${error.message}`);
  const atual =
    data?.settings && typeof data.settings === "object"
      ? { ...(data.settings as Record<string, unknown>) }
      : {};
  const { error: upd } = await admin
    .from("crm_pipelines")
    .update({
      vocabulary: definition.vocabulary ?? data?.vocabulary ?? {},
      settings: {
        ...atual,
        fields: definition.fields,
        lost_reasons: definition.lostReasons,
        canonical_tags: definition.canonicalTags,
        copilot_overlay: definition.copilotOverlay,
      },
    } as never)
    .eq("id", pipelineId)
    .eq("organization_id", orgId);
  if (upd) throw new Error(`gravar settings do quadro: ${upd.message}`);
}

async function garantirAutomacao(
  admin: SupabaseClient,
  orgId: string,
  definition: ReadyModelDefinition,
  actorUserId: string | null,
): Promise<string | null> {
  const seed = definition.automation;
  if (!seed) return null;
  const { data: existente, error: sel } = await admin
    .from("automation_rules")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", seed.name)
    .maybeSingle();
  if (sel) throw new Error(`ler automação: ${sel.message}`);
  if (existente) return (existente as { id: string }).id;

  const { data: criado, error: ins } = await admin
    .from("automation_rules")
    .insert({
      organization_id: orgId,
      name: seed.name,
      trigger_event: seed.trigger_event,
      conditions: [],
      actions: seed.actions,
      is_active: true,
      created_by_user_id: actorUserId,
    } as never)
    .select("id")
    .single();
  if (ins || !criado) throw new Error(`criar automação: ${ins?.message ?? "sem id"}`);
  return (criado as { id: string }).id;
}

function grafoDeSilencio(templateId: string): FlowGraph {
  return {
    nodes: [
      { id: "t1", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: {} },
      {
        id: "a1",
        type: "action",
        label: "Lembrete",
        position: { x: 220, y: 0 },
        config: { mode: "template", template_id: templateId },
      },
      {
        id: "e1",
        type: "end",
        label: "Fim",
        position: { x: 440, y: 0 },
        config: { outcome: "converted" },
      },
    ],
    edges: [
      { id: "t1-a1", source: "t1", target: "a1", priority: 0, condition: { type: "always" } },
      { id: "a1-e1", source: "a1", target: "e1", priority: 0, condition: { type: "always" } },
    ],
  };
}

async function garantirFollowup(
  admin: SupabaseClient,
  orgId: string,
  definition: ReadyModelDefinition,
  actorUserId: string | null,
): Promise<{ id: string; criou: boolean }> {
  const seed = definition.followup;
  if (!seed) throw new Error("follow-up sem seed");

  const { data: pointer, error: sel } = await admin
    .from("followup_flow_pointers")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", seed.name)
    .maybeSingle();
  if (sel) throw new Error(`ler follow-up: ${sel.message}`);
  if (pointer) return { id: (pointer as { id: string }).id, criou: false };

  const templateId = await garantirTemplate(admin, orgId, seed.template_name, seed.template_body, actorUserId);
  const graph = grafoDeSilencio(templateId);
  const validacao = validateFlowForPublish(graph);
  if (!validacao.ok) {
    throw new Error(`grafo de follow-up inválido: ${validacao.errors.map((e) => e.code).join(",")}`);
  }

  const { data: criado, error: ins } = await admin
    .from("followup_flow_pointers")
    .insert({
      organization_id: orgId,
      name: seed.name,
      status: "draft",
      draft_graph: graph,
      handoff_policy: "pause",
      trigger_config: {
        kind: "silence",
        params: { threshold_minutes: seed.silence_threshold_minutes },
        cancel_on_reply: true,
      },
    } as never)
    .select("id")
    .single();
  if (ins?.code === "23505") {
    const { data: deNovo } = await admin
      .from("followup_flow_pointers")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", seed.name)
      .maybeSingle();
    if (!deNovo) throw new Error("follow-up colidiu e sumiu");
    return { id: (deNovo as { id: string }).id, criou: false };
  }
  if (ins || !criado) throw new Error(`criar follow-up: ${ins?.message ?? "sem id"}`);
  const pointerId = (criado as { id: string }).id;

  if (actorUserId) {
    const pub = await publishFollowupFlowVersion(admin, {
      orgId,
      pointerId,
      graph,
      createdBy: actorUserId,
    });
    if (!pub.ok) throw new Error(`publicar follow-up: ${pub.message}`);
  }
  return { id: pointerId, criou: true };
}

async function garantirTemplate(
  admin: SupabaseClient,
  orgId: string,
  title: string,
  body: string,
  actorUserId: string | null,
): Promise<string> {
  const { data: existente, error: sel } = await admin
    .from("message_templates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("title", title)
    .maybeSingle();
  if (sel) throw new Error(`ler template: ${sel.message}`);
  if (existente) return (existente as { id: string }).id;

  const { data: criado, error: ins } = await admin
    .from("message_templates")
    .insert({
      organization_id: orgId,
      owner_user_id: null,
      title,
      body,
      created_by_user_id: actorUserId,
    } as never)
    .select("id")
    .single();
  if (ins || !criado) throw new Error(`criar template: ${ins?.message ?? "sem id"}`);
  return (criado as { id: string }).id;
}

async function gravarPerfil(
  admin: SupabaseClient,
  orgId: string,
  settings: Record<string, unknown>,
  perfil: ReturnType<typeof montarBlocoPerfil>,
): Promise<void> {
  const { error } = await admin
    .from("organizations")
    .update({
      settings: {
        ...settings,
        [CHAVE_PERFIL]: perfil,
      },
    } as never)
    .eq("id", orgId);
  if (error) throw new Error(`gravar perfil: ${error.message}`);
}
