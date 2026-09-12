/**
 * GET /api/v1/home/snapshot — agrega fontes existentes da Home.
 *
 * Agent recebe só personal + funil próprio.
 * Manager/admin recebe team / commercial / campaigns.
 * organization_id vem do cookie, nunca do body.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { isServiceRoleConfigured } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { carregarSnapshotDaHome } from "@/lib/home/snapshot";
import { ehPeriodoPronto, type PeriodoPronto } from "@/lib/supervisao/periodo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", { requestId, resource: "home" });
  if (!authz.ok) return authz.response;

  const raw = req.nextUrl.searchParams.get("periodo") ?? "7d";
  const periodo: PeriodoPronto = ehPeriodoPronto(raw) ? raw : "7d";

  const supabase = await createClient();
  const admin = isServiceRoleConfigured() ? createAdminClient() : null;

  try {
    const snap = await carregarSnapshotDaHome(supabase, {
      organizationId: authz.org.orgId,
      userId: authz.user.id,
      role: authz.org.role,
      periodo,
      admin,
    });
    return ok(snap, { requestId });
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Falha ao carregar a Home.",
      500,
      { requestId },
    );
  }
}
