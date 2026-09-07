"use server";

/**
 * Passo de organização: mostra o quadro do Ready Model e grava via instalador
 * genérico. A proposta viaja da tela de volta — o que se grava é o que a
 * pessoa viu (Personalizado pode editar nomes).
 */
import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarProposta, validarProposta, type PropostaDeFunil } from "@/lib/onboarding/proposta-de-funil";
import { aplicarReadyModel } from "@/lib/ready-models/aplicar";
import { resolverDefinition } from "@/lib/ready-models/catalogo";
import { requireOnboardingCtx, patchOnboardingState, loadOnboardingState, OnboardingError } from "./_shared";

export interface QuadroAtual {
  pipelineId: string;
  nome: string;
  colunas: string[];
}

async function carregarQuadroAtual(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<QuadroAtual | null> {
  const { data: funil } = await admin
    .from("crm_pipelines")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  if (!funil) return null;

  const { data: etapas } = await admin
    .from("crm_stages")
    .select("name, position")
    .eq("pipeline_id", funil.id)
    .eq("is_archived", false)
    .order("position");

  return {
    pipelineId: funil.id as string,
    nome: String(funil.name ?? ""),
    colunas: (etapas ?? []).map((e) => String(e.name ?? "")),
  };
}

export interface DadosDoPasso {
  atual: QuadroAtual | null;
  proposta: PropostaDeFunil;
  rotulo: string;
  editavel: boolean;
}

export async function dadosDoPasso(orgId: string): Promise<DadosDoPasso> {
  const admin = createAdminClient();
  const atual = await carregarQuadroAtual(admin, orgId);
  let id = "personalizado";
  let subtype: string | undefined;
  try {
    const { state } = await loadOnboardingState(orgId);
    id = state.welcome?.ready_model_id ?? "personalizado";
    subtype = state.welcome?.ready_model_subtype;
  } catch {
    id = "personalizado";
  }
  const definition = resolverDefinition(id, subtype);
  if (!definition) {
    const fallback = resolverDefinition("personalizado");
    return {
      atual,
      proposta: fallback!.pipeline,
      rotulo: fallback!.label,
      editavel: true,
    };
  }
  return {
    atual,
    proposta: definition.pipeline,
    rotulo: definition.label,
    editavel: definition.id === "personalizado",
  };
}

export type ResultadoDoQuadro =
  | { ok: true }
  | { ok: false; erro: string };

export async function aplicarQuadro(formData: FormData): Promise<ResultadoDoQuadro> {
  let ctx;
  try {
    ctx = await requireOnboardingCtx();
  } catch (err) {
    if (err instanceof OnboardingError) return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
    throw err;
  }

  let bruta: unknown;
  try {
    bruta = JSON.parse(String(formData.get("quadro") ?? "null"));
  } catch {
    return { ok: false, erro: "Não consegui ler o quadro. Recarregue a página e tente de novo." };
  }

  const proposta: PropostaDeFunil = normalizarProposta(
    (bruta ?? {}) as { nome?: unknown; etapas?: unknown },
  );
  const veredito = validarProposta(proposta);
  if (!veredito.ok) return { ok: false, erro: veredito.erros.join(" ") };

  const { state } = await loadOnboardingState(ctx.orgId);
  const definition = resolverDefinition(
    state.welcome?.ready_model_id ?? "personalizado",
    state.welcome?.ready_model_subtype,
  );
  if (!definition) return { ok: false, erro: "Não achei o modelo escolhido. Volte ao primeiro passo." };

  const admin = createAdminClient();
  try {
    const r = await aplicarReadyModel(admin, ctx.orgId, definition, {
      followup: false,
      noopSeJaAplicado: false,
      actorUserId: ctx.userId,
      pipelineOverride: proposta,
    });
    await patchOnboardingState(ctx.orgId, {
      funil: {
        pipeline_id: r.pipelinePadraoId,
        origem: "ready_model",
        etapas: proposta.etapas.length,
      },
    });
    await audit({
      action: "onboarding.quadro_montado",
      actorUserId: ctx.userId,
      organizationId: ctx.orgId,
      resourceType: "crm_pipeline",
      resourceId: r.pipelinePadraoId,
      metadata: {
        origem: "ready_model",
        modelo: definition.id,
        version: definition.version,
        etapas: proposta.etapas.length,
        nome: proposta.nome,
      },
    });
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Não consegui salvar o quadro.",
    };
  }

  redirect("/onboarding");
}

export async function pularQuadro(): Promise<void> {
  const ctx = await requireOnboardingCtx();
  await patchOnboardingState(ctx.orgId, { funil: { skipped: true } });
  await audit({
    action: "onboarding.quadro_pulado",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "organization",
    resourceId: ctx.orgId,
  });
  redirect("/onboarding");
}
