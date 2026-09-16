/**
 * Instalador genérico de Pack. Recebe o id, resolve a definition, copia.
 * Reaplicar o mesmo id+version só preenche o que falta.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { lerColecoesDoSettings, type ColecaoDeConhecimento } from "@/lib/ai/knowledge/colecoes";
import { AGENT_CONFIG_DEFAULTS } from "@/lib/ai/guardrails-schema";
import { AI_MODE_PADRAO_ORG_NOVA, type AiMode } from "@/lib/schemas/settings";
import { lerAiMode } from "@/lib/ai/execucao/modos";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { definirEstadoDoPack } from "@/lib/business-packs/estado";
import {
  artifactsVazios,
  fundirArtifacts,
  lerPackGravado,
  montarBlocoPack,
} from "@/lib/business-packs/perfil";
import type {
  BusinessPackDefinition,
  BusinessPackGravado,
  OpcoesDoPack,
  PackArtifacts,
  PackFollowupSeed,
  ResultadoDoPack,
} from "@/lib/business-packs/tipos";
import { CHAVE_PACK } from "@/lib/business-packs/tipos";
import { tituloDoTemplateDoFluxo } from "@/lib/business-packs/sementes";
import { grafoDoFluxoPronto } from "@/lib/negocio/grafos-do-pack";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";
import { aplicarReadyModel } from "@/lib/ready-models/aplicar";
import { resolverDefinition } from "@/lib/ready-models/catalogo";

export async function aplicarBusinessPack(
  admin: SupabaseClient,
  orgId: string,
  packId: string,
  options: OpcoesDoPack = {},
): Promise<ResultadoDoPack> {
  const definition = resolverPack(packId);
  if (!definition) throw new Error(`pack desconhecido: ${packId}`);

  const settings = await lerSettings(admin, orgId);
  const gravado = lerPackGravado(settings);
  const artifacts = gravado?.artifacts ?? artifactsVazios();

  const ready = resolverDefinition(definition.ready_model_id, definition.ready_model_subtype);
  if (!ready) throw new Error("ready model do pack não encontrado");

  const quadro = await aplicarReadyModel(admin, orgId, ready, {
    followup: false,
    noopSeJaAplicado: false,
    actorUserId: options.actorUserId ?? null,
    pipelineOverride: definition.pipeline,
  });

  const settingsAposReady = await lerSettings(admin, orgId);
  const colecoes = await garantirColecoes(admin, orgId, settingsAposReady, definition, artifacts);
  const agentes = await garantirAgentes(admin, orgId, definition, colecoes.ids, artifacts, options.actorUserId ?? null);
  const templates = await garantirTemplates(admin, orgId, definition, artifacts, options.actorUserId ?? null);
  const etapas = await mapaDeEtapas(admin, orgId, quadro.pipelinePadraoId);
  const automacoes = await garantirAutomacoes(
    admin,
    orgId,
    definition,
    artifacts,
    etapas,
    options.actorUserId ?? null,
  );
  const followups = await garantirFollowups(
    admin,
    orgId,
    definition,
    artifacts,
    etapas,
    options.actorUserId ?? null,
  );
  await semearAiModeSeSeguro(admin, orgId, definition.ai_mode_default);
  await adaptarAgentePadraoDoPack(admin, orgId, definition, agentes.ids.recepcao);

  const novos: PackArtifacts = {
    pipeline_id: quadro.pipelinePadraoId,
    agent_keys: agentes.ids,
    collection_slugs: colecoes.ids,
    template_keys: templates.ids,
    automation_keys: automacoes.ids,
    campaign_keys: templates.campaignIds,
    followup_keys: followups.ids,
  };
  const fundidos = fundirArtifacts(artifacts, novos);
  const pack = montarBlocoPack(
    definition.id,
    definition.version,
    fundidos,
    gravado?.installed_at,
  );

  await gravarPack(admin, orgId, await lerSettings(admin, orgId), pack);
  if (gravado?.status === "inactive") {
    await definirEstadoDoPack(admin, orgId, true);
  }

  const criou = {
    agentes: agentes.criou,
    colecoes: colecoes.criou,
    templates: templates.criou,
    automacoes: automacoes.criou,
    campanhas: templates.criouCampanhas,
    fluxos: followups.criou,
  };
  const nadaNovo = Object.values(criou).every((n) => n === 0) && mesmoPackAplicadoSimples(gravado, pack);
  if (nadaNovo) return { ok: true, noop: true, pack };

  return { ok: true, noop: false, pack, criou };
}

function mesmoPackAplicadoSimples(
  gravado: BusinessPackGravado | null,
  atual: BusinessPackGravado,
): boolean {
  return Boolean(gravado && gravado.id === atual.id && gravado.version === atual.version);
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

async function gravarPack(
  admin: SupabaseClient,
  orgId: string,
  settings: Record<string, unknown>,
  pack: BusinessPackGravado,
): Promise<void> {
  const { error } = await admin
    .from("organizations")
    .update({ settings: { ...settings, [CHAVE_PACK]: pack } } as never)
    .eq("id", orgId);
  if (error) throw new Error(`gravar pack: ${error.message}`);
}

async function garantirColecoes(
  admin: SupabaseClient,
  orgId: string,
  settings: Record<string, unknown>,
  definition: BusinessPackDefinition,
  artifacts: PackArtifacts,
): Promise<{ ids: Record<string, string>; criou: number }> {
  const atuais = lerColecoesDoSettings(settings);
  const ids: Record<string, string> = { ...artifacts.collection_slugs };
  let criou = 0;
  const lista: ColecaoDeConhecimento[] = [...atuais];

  for (const seed of definition.collections) {
    if (ids[seed.slug]) {
      const aindaExiste = lista.some((c) => c.id === ids[seed.slug] || c.slug === seed.slug);
      if (aindaExiste) continue;
    }
    const existente = lista.find((c) => c.slug === seed.slug);
    if (existente) {
      ids[seed.slug] = existente.id;
      continue;
    }
    const nova = { id: randomUUID(), name: seed.name, slug: seed.slug };
    lista.push(nova);
    ids[seed.slug] = nova.id;
    criou += 1;
  }

  if (criou > 0) {
    const { error } = await admin
      .from("organizations")
      .update({ settings: { ...settings, knowledge_collections: lista } } as never)
      .eq("id", orgId);
    if (error) throw new Error(`gravar coleções: ${error.message}`);
  }
  return { ids, criou };
}

async function garantirAgentes(
  admin: SupabaseClient,
  orgId: string,
  definition: BusinessPackDefinition,
  collectionIds: Record<string, string>,
  artifacts: PackArtifacts,
  actorUserId: string | null,
): Promise<{ ids: Record<string, string>; criou: number }> {
  const ids: Record<string, string> = { ...artifacts.agent_keys };
  let criou = 0;

  for (const spec of definition.specialties) {
    if (ids[spec.key]) {
      const { data: vivo } = await admin
        .from("ai_agents")
        .select("id")
        .eq("organization_id", orgId)
        .eq("id", ids[spec.key])
        .is("archived_at", null)
        .maybeSingle();
      if (vivo) continue;
    }

    const { data: porNome } = await admin
      .from("ai_agents")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", spec.name)
      .is("archived_at", null)
      .maybeSingle();
    if (porNome) {
      ids[spec.key] = (porNome as { id: string }).id;
      continue;
    }

    const knowledgeIds = spec.collection_slugs
      .map((slug) => collectionIds[slug])
      .filter((id): id is string => typeof id === "string");

    const { data: criado, error } = await admin
      .from("ai_agents")
      .insert({
        organization_id: orgId,
        name: spec.name,
        description: spec.description,
        model: "anthropic/claude-sonnet-4-6",
        system_prompt: spec.voice,
        is_active: true,
        is_default: false,
        kind: "rag_bot",
        created_by: actorUserId,
        config: {
          ...AGENT_CONFIG_DEFAULTS,
          knowledge_collection_ids: knowledgeIds,
          pack_specialty_key: spec.key,
          tool_ids: spec.tool_ids,
        },
      } as never)
      .select("id")
      .single();
    if (error || !criado) throw new Error(`criar agente ${spec.key}: ${error?.message ?? "sem id"}`);
    ids[spec.key] = (criado as { id: string }).id;
    criou += 1;
  }
  return { ids, criou };
}

async function garantirTemplates(
  admin: SupabaseClient,
  orgId: string,
  definition: BusinessPackDefinition,
  artifacts: PackArtifacts,
  actorUserId: string | null,
): Promise<{ ids: Record<string, string>; campaignIds: Record<string, string>; criou: number; criouCampanhas: number }> {
  const ids: Record<string, string> = { ...artifacts.template_keys };
  const campaignIds: Record<string, string> = { ...artifacts.campaign_keys };
  let criou = 0;
  let criouCampanhas = 0;

  for (const seed of definition.quick_replies) {
    const id = await garantirUmTemplate(admin, orgId, seed.title, seed.body, ids[seed.key], actorUserId);
    if (!ids[seed.key] || ids[seed.key] !== id) {
      if (!artifacts.template_keys[seed.key]) criou += 1;
    }
    ids[seed.key] = id;
  }
  for (const seed of definition.campaigns) {
    const id = await garantirUmTemplate(admin, orgId, seed.title, seed.body, campaignIds[seed.key], actorUserId);
    if (!artifacts.campaign_keys[seed.key]) criouCampanhas += 1;
    campaignIds[seed.key] = id;
  }
  return { ids, campaignIds, criou, criouCampanhas };
}

async function garantirUmTemplate(
  admin: SupabaseClient,
  orgId: string,
  title: string,
  body: string,
  idConhecido: string | undefined,
  actorUserId: string | null,
): Promise<string> {
  if (idConhecido) {
    const { data } = await admin
      .from("message_templates")
      .select("id")
      .eq("organization_id", orgId)
      .eq("id", idConhecido)
      .maybeSingle();
    if (data) return (data as { id: string }).id;
  }
  const { data: existente } = await admin
    .from("message_templates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("title", title)
    .maybeSingle();
  if (existente) return (existente as { id: string }).id;

  const { data: criado, error } = await admin
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
  if (error || !criado) throw new Error(`criar template: ${error?.message ?? "sem id"}`);
  return (criado as { id: string }).id;
}

async function mapaDeEtapas(
  admin: SupabaseClient,
  orgId: string,
  pipelineId: string | undefined,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!pipelineId) return out;
  const { data, error } = await admin
    .from("crm_stages")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("pipeline_id", pipelineId);
  if (error) throw new Error(`ler etapas do funil: ${error.message}`);
  for (const row of data ?? []) {
    const nome = typeof row.name === "string" ? row.name.trim() : "";
    const id = typeof row.id === "string" ? row.id : "";
    if (nome && id) out.set(nome, id);
  }
  return out;
}

function condicoesDaAutomacao(
  seed: BusinessPackDefinition["automations"][number],
  etapas: Map<string, string>,
): Array<{ field: string; op: "eq"; value: string }> {
  const nome = seed.stage_name?.trim();
  if (!nome) return [];
  const stageId = etapas.get(nome);
  if (!stageId) return [];
  return [{ field: "lead.stage_id", op: "eq", value: stageId }];
}

async function garantirAutomacoes(
  admin: SupabaseClient,
  orgId: string,
  definition: BusinessPackDefinition,
  artifacts: PackArtifacts,
  etapas: Map<string, string>,
  actorUserId: string | null,
): Promise<{ ids: Record<string, string>; criou: number }> {
  const ids: Record<string, string> = { ...artifacts.automation_keys };
  let criou = 0;

  for (const seed of definition.automations) {
    if (seed.requires_gestao) continue;
    if (!seed.trigger_event || !seed.actions?.length) continue;
    if (ids[seed.key]) {
      const { data } = await admin
        .from("automation_rules")
        .select("id")
        .eq("organization_id", orgId)
        .eq("id", ids[seed.key])
        .maybeSingle();
      if (data) continue;
    }
    const { data: porNome } = await admin
      .from("automation_rules")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", seed.name)
      .maybeSingle();
    if (porNome) {
      ids[seed.key] = (porNome as { id: string }).id;
      continue;
    }
    const { data: criado, error } = await admin
      .from("automation_rules")
      .insert({
        organization_id: orgId,
        name: seed.name,
        trigger_event: seed.trigger_event,
        conditions: condicoesDaAutomacao(seed, etapas),
        actions: seed.actions,
        is_active: false,
        created_by_user_id: actorUserId,
      } as never)
      .select("id")
      .single();
    if (error || !criado) throw new Error(`criar automação ${seed.key}: ${error?.message ?? "sem id"}`);
    ids[seed.key] = (criado as { id: string }).id;
    criou += 1;
  }
  return { ids, criou };
}

function triggerDoFluxo(
  seed: PackFollowupSeed,
  etapas: Map<string, string>,
): { kind: "silence" | "stage_change"; params: Record<string, unknown>; cancel_on_reply: true } | null {
  if (seed.kind === "silence") {
    const minutos = seed.threshold_minutes ?? 120;
    return {
      kind: "silence",
      params: { threshold_minutes: minutos },
      cancel_on_reply: true,
    };
  }
  const stageId = seed.stage_name ? etapas.get(seed.stage_name.trim()) : undefined;
  if (!stageId) return null;
  return {
    kind: "stage_change",
    params: { stage_id: stageId },
    cancel_on_reply: true,
  };
}

async function garantirFollowups(
  admin: SupabaseClient,
  orgId: string,
  definition: BusinessPackDefinition,
  artifacts: PackArtifacts,
  etapas: Map<string, string>,
  actorUserId: string | null,
): Promise<{ ids: Record<string, string>; criou: number }> {
  const ids: Record<string, string> = { ...artifacts.followup_keys };
  let criou = 0;

  for (const seed of definition.followups) {
    const trigger = triggerDoFluxo(seed, etapas);
    if (!trigger) continue;
    if (ids[seed.key]) {
      const { data } = await admin
        .from("followup_flow_pointers")
        .select("id")
        .eq("organization_id", orgId)
        .eq("id", ids[seed.key])
        .maybeSingle();
      if (data) continue;
    }
    const { data: porNome } = await admin
      .from("followup_flow_pointers")
      .select("id")
      .eq("organization_id", orgId)
      .eq("name", seed.name)
      .maybeSingle();
    if (porNome) {
      ids[seed.key] = (porNome as { id: string }).id;
      continue;
    }

    const templateId = await garantirUmTemplate(
      admin,
      orgId,
      tituloDoTemplateDoFluxo(seed.key),
      seed.message,
      undefined,
      actorUserId,
    );
    const graph = grafoDoFluxoPronto(seed, templateId);
    const validacao = validateFlowForPublish(graph);
    if (!validacao.ok) {
      throw new Error(`grafo do fluxo ${seed.key}: ${validacao.errors.map((e) => e.code).join(",")}`);
    }

    const { data: criado, error } = await admin
      .from("followup_flow_pointers")
      .insert({
        organization_id: orgId,
        name: seed.name,
        status: "draft",
        draft_graph: graph,
        handoff_policy: "pause",
        trigger_config: trigger,
      } as never)
      .select("id")
      .single();
    if (error?.code === "23505") {
      const { data: deNovo } = await admin
        .from("followup_flow_pointers")
        .select("id")
        .eq("organization_id", orgId)
        .eq("name", seed.name)
        .maybeSingle();
      if (!deNovo) throw new Error(`criar fluxo ${seed.key}: colidiu e sumiu`);
      ids[seed.key] = (deNovo as { id: string }).id;
      continue;
    }
    if (error || !criado) throw new Error(`criar fluxo ${seed.key}: ${error?.message ?? "sem id"}`);
    ids[seed.key] = (criado as { id: string }).id;
    criou += 1;
  }
  return { ids, criou };
}

async function semearAiModeSeSeguro(
  admin: SupabaseClient,
  orgId: string,
  padrao: AiMode,
): Promise<void> {
  const settings = await lerSettings(admin, orgId);
  const atual = settings.ai_mode;
  const efetivo = atual === undefined || atual === null || atual === ""
    ? AI_MODE_PADRAO_ORG_NOVA
    : lerAiMode(atual);
  if (efetivo !== "off") return;
  if (padrao === "autonomous") return;
  const { error } = await admin
    .from("organizations")
    .update({ settings: { ...settings, ai_mode: padrao } } as never)
    .eq("id", orgId);
  if (error) throw new Error(`semear ai_mode: ${error.message}`);
}

const PROMPT_DE_LOJA = /^Você atende os clientes de/;

/**
 * O agente default do wizard continua sendo UM. Se o prompt ainda é o de loja,
 * trocamos só a voz — não publicamos outro bot no WhatsApp.
 */
export async function adaptarAgentePadraoDoPack(
  admin: SupabaseClient,
  orgId: string,
  definition?: BusinessPackDefinition,
  recepcaoId?: string,
): Promise<void> {
  const pack = definition ?? (await packDaOrg(admin, orgId));
  if (!pack) return;
  const recepcao = pack.specialties.find((s) => s.is_default) ?? pack.specialties[0];
  if (!recepcao) return;

  const { data: def } = await admin
    .from("ai_agents")
    .select("id, name, system_prompt")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .is("archived_at", null)
    .maybeSingle();
  if (!def) return;
  const prompt = String((def as { system_prompt?: string }).system_prompt ?? "");
  const nome = String((def as { name?: string }).name ?? "");
  const aindaPadrao = PROMPT_DE_LOJA.test(prompt) || nome === "Atendente IA";
  if (!aindaPadrao) return;

  await admin
    .from("ai_agents")
    .update({
      name: recepcao.name,
      system_prompt: recepcao.voice,
      description: recepcao.description,
    } as never)
    .eq("id", (def as { id: string }).id)
    .eq("organization_id", orgId);

  if (recepcaoId && recepcaoId !== (def as { id: string }).id) {
    // especialidade recepção já existe à parte — o default é a cara da conversa
  }
}

async function packDaOrg(
  admin: SupabaseClient,
  orgId: string,
): Promise<BusinessPackDefinition | null> {
  const settings = await lerSettings(admin, orgId);
  const gravado = lerPackGravado(settings);
  if (!gravado) return null;
  return resolverPack(gravado.id);
}
