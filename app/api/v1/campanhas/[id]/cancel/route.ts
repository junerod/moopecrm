import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { cancelarCampanha } from "@/lib/campanhas/worker";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;

  const supabase = await createClient();
  const r = await cancelarCampanha(supabase, {
    organizationId: authz.org.orgId,
    campaignId: id,
  });
  if (!r.ok) {
    return fail("state_conflict", "Campanha não pode ser cancelada.", 409, { requestId });
  }

  void audit({
    action: "campaign.cancelled",
    requestId,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    resourceType: "campaigns",
    resourceId: id,
  });

  return ok({ status: "cancelled" }, { requestId });
}
