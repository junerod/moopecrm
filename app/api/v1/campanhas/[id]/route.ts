import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { agregarMetricas } from "@/lib/campanhas/metricas";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Campanha não encontrada.", 404, { requestId });

  const { data: recs } = await supabase
    .from("campaign_recipients")
    .select("status, lead_id")
    .eq("campaign_id", id)
    .eq("organization_id", authz.org.orgId);

  return ok(
    {
      ...data,
      metricas: agregarMetricas((recs ?? []) as Array<{ status: string; lead_id: string | null }>),
    },
    { requestId },
  );
}
