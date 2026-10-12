/**
 * GET/POST /api/v1/integrations/assessor
 * Número que recebe no Meu Assessor o aviso de cliente novo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { chamarAssessor } from "@/lib/assessor/cliente";
import { lerAssessorNasSettings } from "@/lib/assessor/config";
import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(8).max(24),
  enabled: z.boolean(),
  reply_enabled: z.boolean().optional(),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const gate = await requireRole("admin", { requestId, resource: "assessor" });
  if (!gate.ok) return gate.response;

  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", gate.org.orgId)
    .maybeSingle();

  const cfg = lerAssessorNasSettings(data?.settings);
  return ok(
    {
      phone: cfg.phone,
      enabled: cfg.enabled,
      reply_enabled: cfg.replyEnabled,
      secret_configured: env.ASSESSOR_PARTNER_SECRET.trim().length > 0,
    },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const gate = await requireRole("admin", { requestId, resource: "assessor" });
  if (!gate.ok) return gate.response;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return fail("validation_failed", err instanceof Error ? err.message : "body inválido", 422, {
      requestId,
    });
  }

  const admin = createAdminClient();
  const { data: org, error: readErr } = await admin
    .from("organizations")
    .select("display_name, settings")
    .eq("id", gate.org.orgId)
    .maybeSingle();
  if (readErr || !org) {
    return fail("not_found", "Organização não encontrada.", 404, { requestId });
  }

  const settings =
    org.settings && typeof org.settings === "object"
      ? { ...(org.settings as Record<string, unknown>) }
      : {};
  const anterior = lerAssessorNasSettings(settings);
  settings.assessor = {
    phone: body.phone.trim(),
    enabled: body.enabled,
    reply_enabled: body.reply_enabled ?? anterior.replyEnabled,
  };

  const { error: writeErr } = await admin
    .from("organizations")
    .update({ settings })
    .eq("id", gate.org.orgId);
  if (writeErr) {
    return fail("internal", "Não consegui gravar o número.", 500, { requestId });
  }

  let assessor: { ok: boolean; error?: string } = { ok: true };
  if (env.ASSESSOR_PARTNER_SECRET.trim()) {
    if (body.enabled) {
      assessor = await chamarAssessor({
        action: "add",
        phone: body.phone,
        organization: org.display_name,
      });
    }
  } else {
    assessor = { ok: false, error: "secret_missing" };
  }

  await audit({
    action: "assessor.phone_saved",
    organizationId: gate.org.orgId,
    resourceType: "organization",
    resourceId: gate.org.orgId,
    requestId,
    metadata: { enabled: body.enabled, assessor_ok: assessor.ok, assessor_error: assessor.error },
  });

  return ok(
    {
      phone: body.phone.trim(),
      enabled: body.enabled,
      reply_enabled: body.reply_enabled ?? anterior.replyEnabled,
      assessor_ok: assessor.ok,
      assessor_error: assessor.error ?? null,
    },
    { requestId },
  );
}
