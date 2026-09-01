/**
 * Agente padrão "Atendimento locadora" — pelo caminho que já existe
 * (ai_agents + ai_agent_versions). Sem runtime novo, sem segundo WhatsApp.
 *
 * Idempotente: se o agente já existe, devolve. Se o default do onboarding
 * ainda é o texto de loja, adapta. Não publica dois no mesmo canal.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { listSelectableChannels } from "@/lib/channels/selectable";
import { escolherModeloDoProvedor } from "@/lib/ai/agents/escolher-modelo";
import { chaveDePlataforma } from "@/lib/ai/runtime/agent";
import { catalogoComHandler } from "@/lib/ai/agents/capacidades-padrao";
import { ligarPacote } from "@/lib/mcp/tools/selecao-por-pacote";
import { TOOLS_IDS_OPERADOR_LOCADORA } from "@/lib/mcp/tools/locadora";
import { carregarConexaoLocadora } from "@/lib/moope/cliente-locadora";

export const NOME_AGENTE_ATENDIMENTO_LOCADORA = "Atendimento locadora";

export const VOZ_ATENDIMENTO_LOCADORA =
  "Você atende locatários desta locadora no WhatsApp.\n" +
  "1) Se o telefone já identificou o cadastro, não peça CPF.\n" +
  "2) Se não identificou, peça UMA chave: CPF ou telefone. Uma vez.\n" +
  "3) Identificou: pode falar 2ª via (só com o link que o sistema trouxer), " +
  "situação do contrato/placa, e passar para um atendente.\n" +
  "4) Sem cadastro, sem link, ou dúvida de dinheiro/acordo: passe para humano.\n" +
  "5) Nunca invente valor, placa, boleto ou vencimento.\n" +
  "6) Nunca diga que mexeu no sistema / CRM / funil.";

export type OrigemDoAgente = "existente" | "adaptado" | "criado";
export type StatusDoAgente = "published" | "draft";
export type MotivoRascunho = "no_channel" | "sem_chave" | "canal_ocupado" | "no_model";

export interface ResultadoAgenteLocadora {
  ok: boolean;
  agent_id?: string;
  status?: StatusDoAgente;
  origem?: OrigemDoAgente;
  motivo?: MotivoRascunho | "nao_e_locadora";
}

function provedorDaInstalacao(settings: unknown): string {
  const llm = (settings as { llm?: unknown } | null)?.llm;
  const provider = (llm as { provider?: unknown } | null | undefined)?.provider;
  return typeof provider === "string" && provider.trim() !== "" ? provider : "anthropic";
}

export function promptEhPadraoDeLoja(prompt: string | null | undefined): boolean {
  if (!prompt) return true;
  return prompt.startsWith("Você atende os clientes de");
}

export function toolIdsDoConversadorLocadora(): string[] {
  return ligarPacote([], catalogoComHandler(), "atender");
}

async function funisDaLocadora(admin: SupabaseClient, orgId: string): Promise<string[]> {
  const { data } = await admin
    .from("crm_pipelines")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("is_archived", false)
    .in("name", ["Locatários", "Cobrança"]);
  const ids = (data ?? [])
    .map((p) => (p as { id: string }).id)
    .filter(Boolean);
  if (ids.length > 0) return ids;
  const { data: def } = await admin
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  return def?.id ? [def.id as string] : [];
}

async function canalLivre(
  admin: SupabaseClient,
  orgId: string,
  canalId: string,
  excetoAgentId?: string,
): Promise<boolean> {
  const { data } = await admin
    .from("ai_agents")
    .select("id, published_version_id")
    .eq("organization_id", orgId)
    .is("archived_at", null);
  const agentes = (data ?? []) as Array<{ id: string; published_version_id: string | null }>;
  for (const a of agentes) {
    if (!a.published_version_id) continue;
    if (excetoAgentId && a.id === excetoAgentId) continue;
    const { data: v } = await admin
      .from("ai_agent_versions")
      .select("channel_session_id, status")
      .eq("id", a.published_version_id)
      .eq("organization_id", orgId)
      .maybeSingle();
    const ver = v as { channel_session_id?: string; status?: string } | null;
    if (ver?.status === "published" && ver.channel_session_id === canalId) {
      return false;
    }
  }
  return true;
}

async function resolverPublicacao(
  admin: SupabaseClient,
  orgId: string,
  excetoAgentId?: string,
): Promise<{
  publicar: boolean;
  motivo?: MotivoRascunho;
  canalId: string | null;
  provider: string;
  modelId: string | null;
  credentialId: string | null;
}> {
  let canais;
  try {
    canais = await listSelectableChannels(admin, orgId);
  } catch {
    return { publicar: false, motivo: "no_channel", canalId: null, provider: "anthropic", modelId: null, credentialId: null };
  }
  const [canal] = canais;
  if (!canal) {
    return { publicar: false, motivo: "no_channel", canalId: null, provider: "anthropic", modelId: null, credentialId: null };
  }

  const { data: org } = await admin.from("organizations").select("settings").eq("id", orgId).maybeSingle();
  const provider = provedorDaInstalacao(org?.settings);
  const { data: modelos } = await admin
    .from("ai_models")
    .select(
      "model_id, is_default_for_provider, supports_tools, input_price_per_million_cents, output_price_per_million_cents",
    )
    .eq("provider", provider)
    .is("deprecated_at", null);
  const escolha = escolherModeloDoProvedor(
    (modelos ?? []) as Parameters<typeof escolherModeloDoProvedor>[0],
  );
  const { data: credencial } = await admin
    .from("ai_provider_credentials")
    .select("id")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .eq("is_active", true)
    .not("validated_at", "is", null)
    .limit(1)
    .maybeSingle();
  const credentialId = (credencial?.id as string | undefined) ?? null;
  const temChave = Boolean(credentialId) || Boolean(chaveDePlataforma(provider));

  if (!(await canalLivre(admin, orgId, canal.id, excetoAgentId))) {
    return {
      publicar: false,
      motivo: "canal_ocupado",
      canalId: canal.id,
      provider,
      modelId: escolha.escolhido ? escolha.modelId : null,
      credentialId,
    };
  }
  if (!escolha.escolhido) {
    return { publicar: false, motivo: "no_model", canalId: canal.id, provider, modelId: null, credentialId };
  }
  if (!temChave) {
    return {
      publicar: false,
      motivo: "sem_chave",
      canalId: canal.id,
      provider,
      modelId: escolha.modelId,
      credentialId,
    };
  }
  return {
    publicar: true,
    canalId: canal.id,
    provider,
    modelId: escolha.modelId,
    credentialId,
  };
}

function camposDaVersao(base: {
  orgId: string;
  agentId: string;
  userId: string;
  versionNumber: number;
  pipelineIds: string[];
  pub: Awaited<ReturnType<typeof resolverPublicacao>>;
}) {
  if (!base.pub.canalId || !base.pub.modelId) return null;
  return {
    organization_id: base.orgId,
    agent_id: base.agentId,
    version_number: base.versionNumber,
    system_prompt: VOZ_ATENDIMENTO_LOCADORA,
    provider: base.pub.provider,
    model: base.pub.modelId,
    credential_id: base.pub.credentialId,
    tool_ids: toolIdsDoConversadorLocadora(),
    operator_enabled: true,
    operator_model: null,
    operator_tool_ids: [...TOOLS_IDS_OPERADOR_LOCADORA],
    pipeline_ids: base.pipelineIds,
    channel_session_id: base.pub.canalId,
    followup: { enabled: false, flow_pointer_ids: [] },
    handoff_tool_enabled: true,
    status: base.pub.publicar ? "published" : "draft",
    published_at: base.pub.publicar ? new Date().toISOString() : null,
    created_by: base.userId,
  };
}

export async function garantirAgenteAtendimentoLocadora(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
): Promise<ResultadoAgenteLocadora> {
  const conn = await carregarConexaoLocadora(admin, orgId);
  if (!conn) return { ok: false, motivo: "nao_e_locadora" };

  const { data: porNome } = await admin
    .from("ai_agents")
    .select("id, published_version_id")
    .eq("organization_id", orgId)
    .eq("name", NOME_AGENTE_ATENDIMENTO_LOCADORA)
    .is("archived_at", null)
    .maybeSingle();
  if (porNome) {
    return {
      ok: true,
      agent_id: (porNome as { id: string }).id,
      status: (porNome as { published_version_id: string | null }).published_version_id
        ? "published"
        : "draft",
      origem: "existente",
    };
  }

  const { data: def } = await admin
    .from("ai_agents")
    .select("id, published_version_id, system_prompt, name, is_default")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .is("archived_at", null)
    .maybeSingle();

  const defaultRow = def as {
    id: string;
    published_version_id: string | null;
    system_prompt: string | null;
    name: string;
  } | null;

  let promptAtual = defaultRow?.system_prompt ?? null;
  if (defaultRow?.published_version_id) {
    const { data: v } = await admin
      .from("ai_agent_versions")
      .select("system_prompt")
      .eq("id", defaultRow.published_version_id)
      .maybeSingle();
    if (typeof (v as { system_prompt?: string } | null)?.system_prompt === "string") {
      promptAtual = (v as { system_prompt: string }).system_prompt;
    }
  }

  if (defaultRow && promptEhPadraoDeLoja(promptAtual)) {
    return adaptarDefault(admin, orgId, userId, defaultRow.id);
  }

  return criarNovo(admin, orgId, userId, !defaultRow);
}

async function adaptarDefault(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  agentId: string,
): Promise<ResultadoAgenteLocadora> {
  await admin
    .from("ai_agents")
    .update({
      name: NOME_AGENTE_ATENDIMENTO_LOCADORA,
      system_prompt: VOZ_ATENDIMENTO_LOCADORA,
      kind: "mcp_agent",
    })
    .eq("id", agentId)
    .eq("organization_id", orgId);

  const { data: maxRow } = await admin
    .from("ai_agent_versions")
    .select("version_number")
    .eq("agent_id", agentId)
    .eq("organization_id", orgId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = ((maxRow as { version_number?: number } | null)?.version_number ?? 0) + 1;
  return gravarVersao(admin, orgId, userId, agentId, next, "adaptado");
}

async function criarNovo(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  viraDefault: boolean,
): Promise<ResultadoAgenteLocadora> {
  const { data: agent, error } = await admin
    .from("ai_agents")
    .insert({
      organization_id: orgId,
      name: NOME_AGENTE_ATENDIMENTO_LOCADORA,
      system_prompt: VOZ_ATENDIMENTO_LOCADORA,
      kind: "mcp_agent",
      is_default: viraDefault,
      is_active: true,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error || !agent) return { ok: false, motivo: "nao_e_locadora" };
  return gravarVersao(admin, orgId, userId, (agent as { id: string }).id, 1, "criado");
}

async function gravarVersao(
  admin: SupabaseClient,
  orgId: string,
  userId: string,
  agentId: string,
  versionNumber: number,
  origem: OrigemDoAgente,
): Promise<ResultadoAgenteLocadora> {
  const pub = await resolverPublicacao(admin, orgId, agentId);
  const pipelineIds = await funisDaLocadora(admin, orgId);
  const campos = camposDaVersao({
    orgId,
    agentId,
    userId,
    versionNumber,
    pipelineIds,
    pub,
  });
  if (!campos) {
    return { ok: true, agent_id: agentId, status: "draft", origem, motivo: pub.motivo ?? "no_channel" };
  }

  const { data: version, error } = await admin
    .from("ai_agent_versions")
    .insert(campos as never)
    .select("id")
    .single();
  if (error || !version) {
    return { ok: true, agent_id: agentId, status: "draft", origem, motivo: pub.motivo ?? "no_channel" };
  }

  if (pub.publicar) {
    await admin
      .from("ai_agents")
      .update({ published_version_id: (version as { id: string }).id, is_active: true })
      .eq("id", agentId)
      .eq("organization_id", orgId);
    return { ok: true, agent_id: agentId, status: "published", origem };
  }

  return { ok: true, agent_id: agentId, status: "draft", origem, motivo: pub.motivo };
}
