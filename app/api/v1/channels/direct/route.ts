/**
 * GET  /api/v1/channels/direct — estado da conexão Direct.
 * POST /api/v1/channels/direct — valida a conta e grava.
 *
 * A rota não nomeia o transporte. Quem valida mora no seam.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  DIRECT_CHANNEL_LABEL,
  estadoDoDirect,
  gravarSessaoDirect,
  tokenOficialDaOrg,
  validateDirectCredentials,
} from "@/lib/channels/direct";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const conectarSchema = z.object({
  account_id: z.string().trim().min(5).max(64),
  token: z.string().trim().max(4000).optional(),
});

type Gate = { ok: true; orgId: string; userId: string } | { ok: false; resposta: NextResponse };

async function adminGate(requestId: string): Promise<Gate> {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org || ROLE_RANK[org.role] < ROLE_RANK.admin) {
    return { ok: false, resposta: fail("forbidden", "admin_required", 403, { requestId }) };
  }
  return { ok: true, orgId: org.orgId, userId: user.id };
}

function publicBase(req: NextRequest): string {
  const configurada = env.NEXT_PUBLIC_APP_URL;
  const usavel = configurada && !configurada.includes("placeholder.invalid") ? configurada : null;
  return usavel ?? req.headers.get("origin") ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const g = await adminGate(requestId);
  if (!g.ok) return g.resposta;
  const admin = createAdminClient();
  return ok(await estadoDoDirect(admin, g.orgId, publicBase(req)));
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const g = await adminGate(requestId);
  if (!g.ok) return g.resposta;

  const parsed = conectarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("invalid_request", "account_id é obrigatório", 422, { requestId });
  }

  const admin = createAdminClient();
  const token =
    parsed.data.token?.trim() || (await tokenOficialDaOrg(admin, g.orgId)) || "";

  const validacao = await validateDirectCredentials({
    accountId: parsed.data.account_id,
    token,
  });
  if (!validacao.ok) {
    return fail("invalid_request", validacao.reason, 422, { requestId });
  }

  const gravado = await gravarSessaoDirect(admin, {
    organizationId: g.orgId,
    accountId: validacao.accountId,
    username: validacao.username,
    token,
    userId: g.userId,
    requestId,
  });
  if (gravado.error) {
    return fail("internal_error", gravado.error, 500, { requestId });
  }

  return ok({
    connected: true,
    displayName: validacao.username
      ? `@${validacao.username}`
      : DIRECT_CHANNEL_LABEL,
  });
}
