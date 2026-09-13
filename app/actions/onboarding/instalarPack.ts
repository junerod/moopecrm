"use server";

import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { aplicarBusinessPack } from "@/lib/business-packs/aplicar";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOnboardingCtx, patchOnboardingState, loadOnboardingState, OnboardingError } from "./_shared";

export type ResultadoInstalarPack =
  | { ok: true; noop: boolean }
  | { ok: false; erro: string };

export async function instalarPackDoOnboarding(): Promise<ResultadoInstalarPack> {
  let ctx;
  try {
    ctx = await requireOnboardingCtx();
  } catch (err) {
    if (err instanceof OnboardingError) return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
    throw err;
  }

  const { state } = await loadOnboardingState(ctx.orgId);
  const packId = state.welcome?.pack_id;
  if (!packId) return { ok: false, erro: "Nenhum modelo de operação foi escolhido." };
  const definition = resolverPack(packId);
  if (!definition) return { ok: false, erro: "Não achei este modelo." };

  try {
    const admin = createAdminClient();
    const r = await aplicarBusinessPack(admin, ctx.orgId, packId, { actorUserId: ctx.userId });
    await patchOnboardingState(ctx.orgId, {
      pack: { id: definition.id, version: definition.version },
    });
    await audit({
      action: r.noop ? "pack.updated" : "pack.installed",
      actorUserId: ctx.userId,
      organizationId: ctx.orgId,
      resourceType: "organization",
      resourceId: ctx.orgId,
      metadata: { pack_id: definition.id, version: definition.version, noop: r.noop },
    });
  } catch (err) {
    return {
      ok: false,
      erro: err instanceof Error ? err.message : "Não consegui preparar a operação.",
    };
  }

  redirect("/onboarding");
}

export async function pularPack(): Promise<void> {
  const ctx = await requireOnboardingCtx();
  const { state } = await loadOnboardingState(ctx.orgId);
  const packId = state.welcome?.pack_id;
  if (!packId) {
    await patchOnboardingState(ctx.orgId, { pack: { id: "locadora_veiculos", version: "1.0", skipped: true } });
    redirect("/onboarding");
    return;
  }
  const definition = resolverPack(packId);
  await patchOnboardingState(ctx.orgId, {
    pack: { id: definition?.id ?? "locadora_veiculos", version: definition?.version ?? "1.0", skipped: true },
  });
  redirect("/onboarding");
}
