/**
 * POST /api/v1/admin/tenants/[id]/password — admin da plataforma define
 * a senha de quem entra naquele tenant.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { AUTH_LIMITS, authRateLimited } from "@/lib/auth/rate-limit";
import { definirSenhaDeMembro } from "@/lib/auth/definir-senha-de-membro";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { definirSenhaDeMembroSchema } from "@/lib/auth/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const alvoSchema = z.object({ user_id: z.string().uuid() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id: organizationId } = await params;

  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("validation_failed", "Senha inválida ou as senhas não coincidem.", 422, {
      requestId,
    });
  }
  const alvo = alvoSchema.safeParse(raw);
  const senha = definirSenhaDeMembroSchema.safeParse(raw);
  if (!alvo.success || !senha.success) {
    return fail("validation_failed", "Senha inválida ou as senhas não coincidem.", 422, {
      requestId,
    });
  }
  const body = { ...alvo.data, ...senha.data };

  if (await authRateLimited("password_set", adminCtx.user.id, AUTH_LIMITS.password_set)) {
    return fail("rate_limited", "Muitas tentativas. Espere alguns minutos.", 429, { requestId });
  }

  const r = await definirSenhaDeMembro(createAdminClient(), {
    organizationId,
    targetUserId: body.user_id,
    actorUserId: adminCtx.user.id,
    password: body.password,
    origem: "platform",
    requestId,
  });
  if (!r.ok) {
    if (r.code === "not_found") return fail("not_found", r.message, 404, { requestId });
    if (r.code === "state_conflict") return fail("state_conflict", r.message, 409, { requestId });
    return fail("internal_error", "Não foi possível definir a senha.", 500, { requestId });
  }
  return ok({ user_id: body.user_id }, { requestId });
}
