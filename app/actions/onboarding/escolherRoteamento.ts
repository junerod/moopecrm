"use server";

import { redirect } from "next/navigation";

import { audit } from "@/lib/audit";
import { routingConfigSchema } from "@/lib/schemas/routing";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingError, patchOnboardingState, requireOnboardingCtx } from "./_shared";

export type ResultadoDoRoteamento =
  | { ok: true }
  | { ok: false; error: string };

export async function escolherRoteamento(formData: FormData): Promise<ResultadoDoRoteamento> {
  let ctx;
  try {
    ctx = await requireOnboardingCtx();
  } catch (err) {
    if (err instanceof OnboardingError) return { ok: false, error: "Sua sessão expirou." };
    throw err;
  }

  const modo = String(formData.get("mode") ?? "");
  const parsed = routingConfigSchema.safeParse({ mode: modo });
  if (!parsed.success) return { ok: false, error: "Escolha como os atendimentos serão distribuídos." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", ctx.orgId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const atual =
    data?.settings && typeof data.settings === "object"
      ? { ...(data.settings as Record<string, unknown>) }
      : {};
  const { error: upd } = await admin
    .from("organizations")
    .update({
      settings: { ...atual, routing: parsed.data },
    } as never)
    .eq("id", ctx.orgId);
  if (upd) return { ok: false, error: upd.message };

  await patchOnboardingState(ctx.orgId, { routing: { mode: parsed.data.mode } });
  await audit({
    action: "onboarding.roteamento_escolhido",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "organization",
    resourceId: ctx.orgId,
    metadata: { mode: parsed.data.mode },
  });
  redirect("/onboarding");
}

export async function pularRoteamento(): Promise<void> {
  const ctx = await requireOnboardingCtx();
  await patchOnboardingState(ctx.orgId, { routing: { mode: "manual", skipped: true } });
  redirect("/onboarding");
}
