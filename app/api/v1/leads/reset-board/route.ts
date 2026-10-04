/**
 * POST /api/v1/leads/reset-board
 *
 * Só o admin da empresa. Apaga os cards. Contatos e conversas ficam.
 * Corpo: { "confirm": "ZERAR" }.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { esvaziarFunil } from "@/lib/leads/esvaziar-funil";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ confirm: z.string() }).strict();

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", {
    requestId,
    resource: "crm_leads",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail("invalid_request", "Corpo não é JSON válido.", 400, { requestId });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("validation_failed", "Digite ZERAR para esvaziar o funil.", 422, { requestId });
  }

  const supabase = await createClient();
  try {
    const { apagados } = await esvaziarFunil(supabase, authz.org.orgId, parsed.data.confirm);
    await audit({
      action: "lead.funnel_reset",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "crm_lead",
      resourceId: authz.org.orgId,
      requestId,
      metadata: { apagados },
    });
    return ok({ apagados }, { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não consegui esvaziar o funil.";
    const status = message.includes("ZERAR") ? 422 : 500;
    return fail(status === 422 ? "validation_failed" : "internal_error", message, status, {
      requestId,
    });
  }
}
