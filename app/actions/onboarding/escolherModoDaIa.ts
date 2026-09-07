"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { AI_MODES, type AiMode } from "@/lib/schemas/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { OnboardingError, patchOnboardingState, requireOnboardingCtx } from "./_shared";

export type ResultadoDoModoDaIa =
  | { ok: true }
  | { ok: false; error: string };

export async function escolherModoDaIa(formData: FormData): Promise<ResultadoDoModoDaIa> {
  let ctx;
  try {
    ctx = await requireOnboardingCtx();
  } catch (err) {
    if (err instanceof OnboardingError) return { ok: false, error: "Sua sessão expirou." };
    throw err;
  }

  const parsed = z.enum(AI_MODES).safeParse(String(formData.get("ai_mode") ?? ""));
  if (!parsed.success) return { ok: false, error: "Escolha como quer usar a inteligência artificial." };
  const aiMode: AiMode = parsed.data;

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
    .update({ settings: { ...atual, ai_mode: aiMode } } as never)
    .eq("id", ctx.orgId);
  if (upd) return { ok: false, error: upd.message };

  await patchOnboardingState(ctx.orgId, {
    ai: { ai_mode: aiMode, agent_id: "", prompt_template: "simple" },
  });
  await audit({
    action: "onboarding.ai_mode_escolhido",
    actorUserId: ctx.userId,
    organizationId: ctx.orgId,
    resourceType: "organization",
    resourceId: ctx.orgId,
    metadata: { ai_mode: aiMode },
  });
  redirect("/onboarding");
}
