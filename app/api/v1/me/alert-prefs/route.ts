import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { ANTECEDENCIAS_MIN } from "@/lib/comercial/alerta-interno";
import { normalizarE164 } from "@/lib/comercial/telefone-e164";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  alert_whatsapp_phone: z.string().trim().max(20).nullable().optional(),
  alert_proxima_acao: z.boolean().optional(),
  alert_antecedencia_min: z.number().int().refine(
    (n): n is (typeof ANTECEDENCIAS_MIN)[number] =>
      (ANTECEDENCIAS_MIN as readonly number[]).includes(n),
    "Antecedência deve ser 10, 30 ou 60 minutos.",
  ).optional(),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "user_organizations" });
  if (!authz.ok) return authz.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_organizations")
    .select("alert_whatsapp_phone, alert_proxima_acao, alert_antecedencia_min")
    .eq("organization_id", authz.org.orgId)
    .eq("user_id", authz.user.id)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });

  return ok(
    {
      alert_whatsapp_phone: data?.alert_whatsapp_phone ?? null,
      alert_proxima_acao: data?.alert_proxima_acao ?? false,
      alert_antecedencia_min: data?.alert_antecedencia_min ?? 30,
    },
    { requestId },
  );
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "user_organizations" });
  if (!authz.ok) return authz.response;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("validation_failed", "Corpo inválido.", 422, { requestId });
  }
  const parsed = patchSchema.safeParse(corpo);
  if (!parsed.success) {
    return fail("validation_failed", "Preferências inválidas.", 422, {
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  let phone = parsed.data.alert_whatsapp_phone;
  if (phone) {
    const e164 = normalizarE164(phone);
    if (!e164) {
      return fail("validation_failed", "Informe um WhatsApp em E.164 (+55…).", 422, { requestId });
    }
    phone = e164;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_organizations")
    .update({
      ...(parsed.data.alert_whatsapp_phone !== undefined
        ? { alert_whatsapp_phone: phone }
        : {}),
      ...(parsed.data.alert_proxima_acao !== undefined
        ? { alert_proxima_acao: parsed.data.alert_proxima_acao }
        : {}),
      ...(parsed.data.alert_antecedencia_min !== undefined
        ? { alert_antecedencia_min: parsed.data.alert_antecedencia_min }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", authz.org.orgId)
    .eq("user_id", authz.user.id)
    .is("revoked_at", null)
    .select("alert_whatsapp_phone, alert_proxima_acao, alert_antecedencia_min")
    .maybeSingle();

  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!data) return fail("not_found", "Vínculo com a organização não encontrado.", 404, { requestId });

  void audit({
    action: "me.alert_prefs_updated",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "user_organization",
    requestId,
    metadata: {
      alert_proxima_acao: data.alert_proxima_acao,
      alert_antecedencia_min: data.alert_antecedencia_min,
    },
  });

  return ok(data, { requestId });
}
