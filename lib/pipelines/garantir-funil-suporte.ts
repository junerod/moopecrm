/**
 * Garante um funil "Suporte" na org: cria se não existir; não mexe se já houver.
 * Não marca is_default nem inbound — Vendas continua recebendo lead novo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ETAPAS_FUNIL_SUPORTE,
  NOME_FUNIL_SUPORTE,
  VOCABULARIO_SUPORTE,
} from "@/lib/pipelines/funil-suporte";
import { posicaoEntre, slugDeFunil } from "@/lib/pipelines/pipeline-editing";

export type ResultadoFunilSuporte =
  | { criado: false; pipelineId: string; motivo: "ja_existia" }
  | { criado: true; pipelineId: string };

export async function garantirFunilSuporte(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ResultadoFunilSuporte> {
  const { data: existentes, error: listErr } = await supabase
    .from("crm_pipelines")
    .select("id, name, slug, is_archived")
    .eq("organization_id", organizationId);

  if (listErr) {
    throw new Error(listErr.message);
  }

  const ativo = (existentes ?? []).find(
    (p) =>
      !p.is_archived &&
      p.name.trim().toLowerCase() === NOME_FUNIL_SUPORTE.toLowerCase(),
  );
  if (ativo) {
    return { criado: false, pipelineId: ativo.id as string, motivo: "ja_existia" };
  }

  const slugs = (existentes ?? []).map((p) => p.slug as string);
  const { data: maxPos } = await supabase
    .from("crm_pipelines")
    .select("position")
    .eq("organization_id", organizationId)
    .eq("is_archived", false)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = {
    organization_id: organizationId,
    name: NOME_FUNIL_SUPORTE,
    description: "Atendimento pós-venda e tickets de suporte.",
    slug: slugDeFunil(NOME_FUNIL_SUPORTE, slugs),
    position: posicaoEntre(
      maxPos?.position != null ? Number(maxPos.position) : null,
      null,
    ),
    is_default: false,
    vocabulary: { ...VOCABULARIO_SUPORTE },
    settings: {
      fields: [],
      canonical_tags: [],
      lost_reasons: ["moved_to_pipeline", "other"],
    },
  };

  const { data: criado, error: insErr } = await supabase
    .from("crm_pipelines")
    .insert(row)
    .select("id")
    .single();

  if (insErr || !criado) {
    throw new Error(insErr?.message ?? "Falha ao criar funil Suporte.");
  }

  const pipelineId = (criado as { id: string }).id;
  const etapas = ETAPAS_FUNIL_SUPORTE.map((etapa, i) => ({
    organization_id: organizationId,
    pipeline_id: pipelineId,
    name: etapa.name,
    slug: etapa.slug,
    position: (i + 1) * 1000,
    is_won: etapa.is_won,
    is_lost: etapa.is_lost,
  }));

  const { error: etapasErr } = await supabase.from("crm_stages").insert(etapas);
  if (etapasErr) {
    await supabase
      .from("crm_pipelines")
      .delete()
      .eq("id", pipelineId)
      .eq("organization_id", organizationId);
    throw new Error(etapasErr.message);
  }

  return { criado: true, pipelineId };
}
