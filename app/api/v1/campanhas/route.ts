/**
 * GET  /api/v1/campanhas — lista (agent+)
 * POST /api/v1/campanhas — cria draft (manager+)
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const segmentoSchema = z
  .object({
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
    papel: z.string().max(40).nullable().optional(),
    origem: z.string().max(40).nullable().optional(),
    owner_user_id: z.string().uuid().nullable().optional(),
    pipeline_id: z.string().uuid().nullable().optional(),
    stage_id: z.string().uuid().nullable().optional(),
    temperatura: z.enum(["frio", "morno", "quente"]).nullable().optional(),
    contact_ids: z.array(z.string().uuid()).max(2000).optional(),
  })
  .default({});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  channel_session_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  body_text: z.string().max(2000).default(""),
  segment: segmentoSchema,
  scheduled_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, name, status, channel_session_id, template_id, body_text, segment, scheduled_at, started_at, finished_at, created_at",
    )
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data ?? [], { requestId });
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
