import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { concluirProximoPassoComercial } from "@/lib/demandas/concluir-proximo-passo";
import { nomesDosAtendentes } from "@/lib/users/nome-do-atendente";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "demandas" });
  if (!authz.ok) return authz.response;
  const { id } = await params;

  const nomes = await nomesDosAtendentes([authz.user.id]);
  try {
    const gravado = await concluirProximoPassoComercial(createAdminClient(), {
      organizationId: authz.org.orgId,
      demandaId: id,
      userId: authz.user.id,
      userName: nomes.get(authz.user.id) ?? null,
    });
    if (!gravado) return fail("not_found", "Demanda não encontrada, ou já encerrada.", 404, { requestId });

    void audit({
      action: "demanda.proximo_passo_concluido",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "demanda",
      resourceId: id,
      requestId,
      metadata: { texto_anterior: gravado.texto_anterior },
    });

    return ok(gravado, { requestId });
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Falha ao concluir.",
      500,
      { requestId },
    );
  }
}
