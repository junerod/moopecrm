/**
 * POST /api/v1/integrations/moope/reconcile
 *
 * Varre as fichas desta conexão e cola `moope_external_id` no gêmeo
 * que já tem LID. Bearer mop_…. Não funde. Não acorda o agente.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { reconciliarGemeosMoope } from "@/lib/moope/pessoa";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  const conexao = await resolverConexaoPeloBearer(admin, req.headers.get("authorization"));
  if (!conexao) {
    return fail("unauthenticated", "Chave de integração inválida ou desligada.", 401, { requestId });
  }

  const resultado = await reconciliarGemeosMoope(admin, conexao.organization_id);

  await audit({
    action: "moope.reconcile",
    organizationId: conexao.organization_id,
    resourceType: "moope_connection",
    resourceId: conexao.id,
    requestId,
    metadata: resultado,
  });

  return ok({ ...resultado, request_id: requestId }, { requestId });
}
