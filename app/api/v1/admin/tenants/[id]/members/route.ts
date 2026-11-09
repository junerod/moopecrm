/**
 * GET /api/v1/admin/tenants/[id]/members — quem entra neste tenant.
 * Só o admin da plataforma. E-mail vem do Auth, não do body.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id: organizationId } = await params;

  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const admin = createAdminClient();
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle();
  if (!org) return fail("not_found", "Tenant not found", 404, { requestId });

  const { data: rows, error } = await admin
    .from("user_organizations")
    .select("user_id, role, accepted_at, revoked_at")
    .eq("organization_id", organizationId)
    .is("revoked_at", null)
    .order("created_at", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const membros = await Promise.all(
    (rows ?? []).map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      const u = data?.user;
      return {
        user_id: m.user_id,
        role: m.role,
        email: u?.email ?? null,
        full_name: (u?.user_metadata?.full_name as string | undefined) ?? null,
      };
    }),
  );

  return ok(membros, { requestId });
}
