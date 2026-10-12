/**
 * POST /api/v1/integrations/assessor/comando
 * O Assessor chama quando a pessoa manda "ligar alerta lead" ou "desligar alerta lead".
 * O número tem de ser o que o dono cadastrou na tela. Desligar não remove o WhatsApp do Assessor.
 */
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { mesmoTelefone } from "@/lib/assessor/comando";
import { lerAssessorNasSettings } from "@/lib/assessor/config";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(8).max(24),
  enabled: z.boolean(),
});

function segredoConfere(got: string | null): boolean {
  const expected = env.ASSESSOR_PARTNER_SECRET.trim();
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!segredoConfere(req.headers.get("x-assessor-moope-secret"))) {
    return fail("unauthenticated", "Segredo do Assessor inválido.", 401, { requestId });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return fail("validation_failed", err instanceof Error ? err.message : "body inválido", 422, {
      requestId,
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").select("id, settings");
  if (error) return fail("internal", "Não li as organizações.", 500, { requestId });

  const alvos = (data ?? []).filter((org) => {
    const cfg = lerAssessorNasSettings(org.settings);
    return mesmoTelefone(cfg.phone, body.phone);
  });
  if (!alvos.length) {
    return fail("not_found", "Esse número não está cadastrado no CRM.", 404, { requestId });
  }

  for (const org of alvos) {
    const settings =
      org.settings && typeof org.settings === "object"
        ? { ...(org.settings as Record<string, unknown>) }
        : {};
    const atual = lerAssessorNasSettings(settings);
    settings.assessor = { phone: atual.phone, enabled: body.enabled };
    const { error: writeErr } = await admin
      .from("organizations")
      .update({ settings })
      .eq("id", org.id);
    if (writeErr) return fail("internal", "Não gravei o aviso.", 500, { requestId });
    await audit({
      action: "assessor.alert_toggled",
      organizationId: org.id,
      resourceType: "organization",
      resourceId: org.id,
      requestId,
      metadata: { enabled: body.enabled },
    });
  }

  return ok({ enabled: body.enabled, matched: alvos.length }, { requestId });
}
