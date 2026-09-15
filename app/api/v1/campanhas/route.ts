/**
 * GET  /api/v1/campanhas — lista (agent+)
 * POST /api/v1/campanhas — cria draft (manager+)
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { agregarMetricas, aplicarDesfecho, desfechoPorLeadIds } from "@/lib/campanhas/metricas";
import { createCampanhaSchema } from "@/lib/campanhas/schema";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const createSchema = createCampanhaSchema;

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, name, status, channel_session_id, template_id, body_text, segment, settings, scheduled_at, started_at, finished_at, created_at",
    )
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  const camps = data ?? [];
  const ids = camps.map((c) => (c as { id: string }).id);
  const resumoPorCampanha = new Map<
    string,
    ReturnType<typeof agregarMetricas>
  >();
  if (ids.length > 0) {
    const primeira = await supabase
      .from("campaign_recipients")
      .select("campaign_id, status, lead_id, error, channel")
      .eq("organization_id", authz.org.orgId)
      .in("campaign_id", ids)
      .limit(20_000);
    const recs = primeira.error
      ? (
          await supabase
            .from("campaign_recipients")
            .select("campaign_id, status, lead_id, error")
            .eq("organization_id", authz.org.orgId)
            .in("campaign_id", ids)
            .limit(20_000)
        ).data
      : primeira.data;
    const agrupado = new Map<
      string,
      Array<{ status: string; lead_id: string | null; error: string | null; channel: string | null }>
    >();
    for (const r of (recs ?? []) as Array<{
      campaign_id: string;
      status: string;
      lead_id: string | null;
      error: string | null;
      channel: string | null;
    }>) {
      const lista = agrupado.get(r.campaign_id) ?? [];
      lista.push(r);
      agrupado.set(r.campaign_id, lista);
    }
    const leadIds = [
      ...new Set(
        [...agrupado.values()].flatMap((linhas) =>
          linhas.map((r) => r.lead_id).filter((x): x is string => Boolean(x)),
        ),
      ),
    ];
    const { data: leads } =
      leadIds.length > 0
        ? await supabase
            .from("crm_leads")
            .select("id, status, value_cents")
            .eq("organization_id", authz.org.orgId)
            .in("id", leadIds)
        : { data: [] as Array<{ id: string; status: string | null; value_cents: number | null }> };

    for (const [campId, linhas] of agrupado) {
      const idsDesta = linhas.map((r) => r.lead_id).filter((x): x is string => Boolean(x));
      resumoPorCampanha.set(
        campId,
        aplicarDesfecho(
          agregarMetricas(linhas),
          desfechoPorLeadIds(
            idsDesta,
            (leads ?? []) as Array<{ id: string; status: string | null; value_cents: number | null }>,
          ),
        ),
      );
    }
  }
  return ok(
    camps.map((c) => ({
      ...c,
      metricas: resumoPorCampanha.get((c as { id: string }).id) ?? agregarMetricas([]),
    })),
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("validation_failed", "Corpo inválido.", 422, { requestId });
  }
  const parsed = createSchema.safeParse(corpo);
  if (!parsed.success) {
    return fail("validation_failed", "Campanha inválida.", 422, {
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  const supabase = await createClient();
  if (parsed.data.channel_session_id) {
    const { data: sess } = await supabase
      .from("channel_sessions")
      .select("id")
      .eq("id", parsed.data.channel_session_id)
      .eq("organization_id", authz.org.orgId)
      .maybeSingle();
    if (!sess) {
      return fail("validation_failed", "Sessão de canal não encontrada nesta organização.", 422, {
        requestId,
      });
    }
  }

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      organization_id: authz.org.orgId,
      name: parsed.data.name,
      status: "draft",
      channel_session_id: parsed.data.channel_session_id ?? null,
      template_id: parsed.data.template_id ?? null,
      body_text: parsed.data.body_text,
      segment: parsed.data.segment,
      settings: parsed.data.settings ?? {},
      created_by_user_id: authz.user.id,
      scheduled_at: parsed.data.scheduled_at ?? null,
    })
    .select("*")
    .single();
  if (error || !data) {
    return fail("internal_error", error?.message ?? "Falha ao criar campanha.", 500, { requestId });
  }

  void audit({
    action: "campaign.created",
    requestId,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    resourceType: "campaigns",
    resourceId: (data as { id: string }).id,
    metadata: { name: parsed.data.name },
  });

  return ok(data, { requestId });
}
