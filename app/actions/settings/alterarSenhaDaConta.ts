"use server";

import { headers } from "next/headers";

import { audit } from "@/lib/audit";
import { AUTH_LIMITS, authRateLimited } from "@/lib/auth/rate-limit";
import { changePasswordSchema } from "@/lib/auth/schemas";
import { loadAuthUser } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export type AlterarSenhaResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "validation_failed"
        | "unauthenticated"
        | "rate_limited"
        | "wrong_password"
        | "update_failed";
    };

/**
 * Troca a senha de quem JÁ está logado. Confere a atual via sign-in; não
 * reusa `updatePassword` (aquele encerra a sessão de recovery).
 */
export async function alterarSenhaDaConta(
  input: unknown,
): Promise<AlterarSenhaResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation_failed" };

  const authUser = await loadAuthUser();
  if (!authUser?.email) return { ok: false, error: "unauthenticated" };

  if (await authRateLimited("password_change", authUser.email, AUTH_LIMITS.password_change)) {
    return { ok: false, error: "rate_limited" };
  }

  const supabase = await createClient();
  const { error: prova } = await supabase.auth.signInWithPassword({
    email: authUser.email,
    password: parsed.data.current_password,
  });
  if (prova) return { ok: false, error: "wrong_password" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, error: "update_failed" };

  const hdrs = await headers();
  await audit({
    action: "auth.password_changed",
    actorUserId: authUser.id,
    resourceType: "user",
    resourceId: authUser.id,
    requestId: hdrs.get("x-request-id"),
    ip: hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: hdrs.get("user-agent") ?? null,
    metadata: {},
  });

  return { ok: true };
}
