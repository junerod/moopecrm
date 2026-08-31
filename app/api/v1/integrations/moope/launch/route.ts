/**
 * POST /api/v1/integrations/moope/launch
 *
 * O outro sistema pede um URL de 90s. Só abre se o e-mail já for membro.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { env } from "@/lib/env";
import { emailEMembro, resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { assinarLaunch } from "@/lib/moope/launch";
import { caminhoDoLaunchEhSeguro, MOOPE_LAUNCH_TTL_SECONDS } from "@/lib/moope/tipos";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  path: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  const conexao = await resolverConexaoPeloBearer(admin, req.headers.get("authorization"));
  if (!conexao) {
    return fail("unauthenticated", "Chave de integração inválida ou desligada.", 401, { requestId });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return fail("validation_failed", err instanceof Error ? err.message : "body inválido", 422, {
      requestId,
    });
  }

  const membro = await emailEMembro(admin, conexao.organization_id, body.email);
  if (!membro) {
    return fail(
      "forbidden",
      "Este e-mail não é membro desta organização. Crie a conta no CRM com o mesmo e-mail dos dois lados.",
      403,
      { requestId },
    );
  }

  const path = body.path && caminhoDoLaunchEhSeguro(body.path) ? body.path : "/app/inbox";
  const token = assinarLaunch(
    { email: membro.email, orgId: conexao.organization_id, path },
    env.INTERNAL_SECRET,
  );
  const url = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/v1/integrations/moope/entrar?t=${encodeURIComponent(token)}`;

  await audit({
    action: "moope.launch_issued",
    organizationId: conexao.organization_id,
    resourceType: "moope_connection",
    resourceId: conexao.id,
    requestId,
    metadata: { path },
  });

  return ok({ url, expires_in: MOOPE_LAUNCH_TTL_SECONDS }, { requestId });
}
