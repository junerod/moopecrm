"use server";

import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { aplicarReadyModel } from "@/lib/ready-models/aplicar";
import { resolverDefinition } from "@/lib/ready-models/catalogo";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadOnboardingState,
  OnboardingError,
  patchOnboardingState,
  requireOnboardingCtx,
} from "./_shared";

export type ResultadoDoFollowup =
  | { ok: true }
  | { ok: false; error: string };

export async function escolherFollowup(formData: FormData): Promise<ResultadoDoFollowup> {
  let ctx;
  try {
    ctx = await requireOnboardingCtx();
  } catch (err) {
    if (err instanceof OnboardingError) return { ok: false, error: "Sua sessão expirou." };
    throw err;
  }

  const ativo = String(formData.get("ativo") ?? "") === "sim";
  const { state } = await loadOnboardingState(ctx.orgId);
  const id = state.welcome?.ready_model_id ?? "personalizado";
  const subtype = state.welcome?.ready_model_subtype;
  const definition = resolverDefinition(id, subtype);
  if (!definition) return { ok: false, error: "Não achei o modelo escolhido." };

  const admin = createAdminClient();
  try {
    await aplicarReadyModel(admin, ctx.orgId, definition, {
      followup: ativo,
      noopSeJaAplicado: true,
      actorUserId: ctx.userId,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Não instalei o lembrete." };
  }

  await patchOnboardingState(ctx.orgId, { followup: { ativo } });
  await audit({
    action: "onboarding.followup_escolhido",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "organization",
    resourceId: ctx.orgId,
    metadata: { ativo },
  });
  redirect("/onboarding");
}

export async function pularFollowup(): Promise<void> {
  const ctx = await requireOnboardingCtx();
  await patchOnboardingState(ctx.orgId, { followup: { ativo: false, skipped: true } });
  redirect("/onboarding");
}
