import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { agregarMetricas, aplicarDesfecho, desfechoDosLeads } from "@/lib/campanhas/metricas";
import { patchCampanhaSchema } from "@/lib/campanhas/schema";
import { lerSettings } from "@/lib/campanhas/settings";
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
    .select("status, lead_id, error, channel")
    .eq("campaign_id", id)
    .eq("organization_id", authz.org.orgId);

  const linhas = (recs ?? []) as Array<{
    status: string;
    lead_id: string | null;
    error: string | null;
    channel: string | null;
  }>;
  let metricas = agregarMetricas(linhas);
  const leadIds = [...new Set(linhas.map((r) => r.lead_id).filter((x): x is string => Boolean(x)))];
  if (leadIds.length > 0) {
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("id, status, value_cents")
      .eq("organization_id", authz.org.orgId)
      .in("id", leadIds);
    metricas = aplicarDesfecho(
      metricas,
      desfechoDosLeads(
        (leads ?? []) as Array<{ status: string | null; value_cents: number | null }>,
      ),
    );
  }

  return ok(
    {
      ...data,
      settings: lerSettings((data as { settings?: unknown }).settings),
      metricas,
    },
    { requestId },
  );
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("validation_failed", "Corpo inválido.", 422, { requestId });
  }
  const parsed = patchCampanhaSchema.safeParse(corpo);
  if (!parsed.success) {
    return fail("validation_failed", "Campanha inválida.", 422, { requestId });
  }

  const supabase = await createClient();
  const { data: atual } = await supabase
    .from("campaigns")
    .select("id, status, settings")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!atual) return fail("not_found", "Campanha não encontrada.", 404, { requestId });
  if ((atual as { status: string }).status !== "draft") {
    return fail("state_conflict", "Só rascunho pode ser editado.", 409, { requestId });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.body_text !== undefined) patch.body_text = parsed.data.body_text;
  if (parsed.data.segment !== undefined) patch.segment = parsed.data.segment;
  if (parsed.data.scheduled_at !== undefined) patch.scheduled_at = parsed.data.scheduled_at;
  if (parsed.data.channel_session_id !== undefined) {
    patch.channel_session_id = parsed.data.channel_session_id;
  }
  if (parsed.data.template_id !== undefined) patch.template_id = parsed.data.template_id;
  if (parsed.data.settings !== undefined) {
    patch.settings = { ...lerSettings((atual as { settings?: unknown }).settings), ...parsed.data.settings };
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update(patch)
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .select("*")
    .single();
  if (error || !data) {
    return fail("internal_error", error?.message ?? "Falha ao atualizar.", 500, { requestId });
  }

  void audit({
    action: "campaign.updated",
    requestId,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    resourceType: "campaigns",
    resourceId: id,
  });
  return ok(data, { requestId });
}
