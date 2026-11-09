/**
 * POST /api/v1/team/[user_id]/password — admin do tenant define a senha
 * de um membro. A pessoa troca de novo no próximo login.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { AUTH_LIMITS, authRateLimited } from "@/lib/auth/rate-limit";
import { definirSenhaDeMembro } from "@/lib/auth/definir-senha-de-membro";
import { requireRole } from "@/lib/auth/require-role";
import { definirSenhaDeMembroSchema } from "@/lib/auth/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ user_id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { user_id: targetUserId } = await ctx.params;

  const authz = await requireRole("admin", { requestId, resource: "team" });
  if (!authz.ok) return authz.response;
  const { user, org } = authz;

  const parsed = definirSenhaDeMembroSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Senha inválida ou as senhas não coincidem.", 422, {
      requestId,
    });
  }
  const body = parsed.data;

  if (await authRateLimited("password_set", user.id, AUTH_LIMITS.password_set)) {
    return fail("rate_limited", "Muitas tentativas. Espere alguns minutos.", 429, { requestId });
  }

  const r = await definirSenhaDeMembro(createAdminClient(), {
    organizationId: org.orgId,
    targetUserId,
    actorUserId: user.id,
    password: body.password,
    origem: "tenant",
    requestId,
  });
  if (!r.ok) {
    if (r.code === "not_found") return fail("not_found", r.message, 404, { requestId });
    if (r.code === "state_conflict") return fail("state_conflict", r.message, 409, { requestId });
    return fail("internal_error", "Não foi possível definir a senha.", 500, { requestId });
  }
  return ok({ user_id: targetUserId }, { requestId });
}
