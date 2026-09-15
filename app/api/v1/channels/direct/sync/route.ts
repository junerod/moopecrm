/**
 * POST /api/v1/channels/direct/sync — puxa o Direct que a Graph já vê.
 *
 * Serve a conta que já autorizou: o webhook só pega mensagem nova, e
 * desenvolvimento da Meta esconde conversa de quem não é testador.
 */
import { randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { sincronizarDirectDaOrg } from "@/lib/channels/direct";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  const requestId = randomUUID();
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org || ROLE_RANK[org.role] < ROLE_RANK.admin) {
    return fail("forbidden", "admin_required", 403, { requestId });
  }

  const r = await sincronizarDirectDaOrg(createAdminClient(), org.orgId);
  if (r.error) {
    return fail("invalid_request", r.error, 422, { requestId });
  }
  return ok({ subscribed: r.subscribed, imported: r.imported });
}
