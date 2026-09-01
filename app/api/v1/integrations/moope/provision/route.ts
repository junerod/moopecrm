/**
 * POST /api/v1/integrations/moope/provision
 *
 * A locadora (backend) pede um tenant pronto. Bearer =
 * MOOPE_PROVISION_SECRET (não é mop_). Sem cookie. Sem JWT do operador.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { env } from "@/lib/env";
import { extrairBearer } from "@/lib/moope/chave";
import {
  PISO_DO_SEGREDO_DE_PROVISION,
  provisionarTenantLocadora,
  provisionSecretBate,
} from "@/lib/moope/provisionar";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  partner_tenant_id: z.string().min(1).max(80),
  display_name: z.string().min(2).max(120),
  owner_email: z.string().email(),
  partner_webhook_url: z.string().url().optional().or(z.literal("")),
  partner_api_url: z.string().url().optional().or(z.literal("")),
  rotate_keys: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const esperado = env.MOOPE_PROVISION_SECRET.trim();
  if (esperado.length < PISO_DO_SEGREDO_DE_PROVISION) {
    return fail("unavailable", "Provisionamento desligado nesta instalação.", 503, {
      requestId,
    });
  }

  const recebido =
    extrairBearer(req.headers.get("authorization")) ??
    req.headers.get("x-moope-provision");
  if (!provisionSecretBate(recebido, esperado)) {
    return fail("unauthorized", "Segredo de provisionamento inválido.", 401, {
      requestId,
    });
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
  try {
    const resultado = await provisionarTenantLocadora(admin, {
      partner_tenant_id: body.partner_tenant_id,
      display_name: body.display_name,
      owner_email: body.owner_email,
      partner_webhook_url: body.partner_webhook_url || null,
      partner_api_url: body.partner_api_url || null,
      rotate_keys: body.rotate_keys === true,
    });

    await audit({
      action: "moope.tenant_provisioned",
      organizationId: resultado.organization_id,
      resourceType: "organization",
      resourceId: resultado.organization_id,
      requestId,
      metadata: {
        partner_tenant_id: body.partner_tenant_id,
        criado_agora: resultado.criado_agora,
        chaves_novas: resultado.chaves_novas,
      },
    });

    return ok(resultado, { requestId, status: resultado.criado_agora ? 201 : 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "falha ao provisionar";
    if (msg === "cifra_indisponivel") {
      return fail(
        "internal_error",
        "Cifra indisponível nesta instalação — o segredo de saída não foi gravado.",
        422,
        { requestId },
      );
    }
    return fail("internal_error", msg, 500, { requestId });
  }
}
