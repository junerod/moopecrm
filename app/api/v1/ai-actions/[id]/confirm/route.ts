/**
 * POST /api/v1/ai-actions/:id/confirm
 * Humano confirma. Executa uma vez; segunda chamada é idempotente.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { confirmarPedidoDeAcao } from "@/lib/ai/acoes/confirmar";
import { executarPedidoComoHumano } from "@/lib/ai/acoes/executar";
import { lerAiMode } from "@/lib/ai/execucao/modos";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { audit } from "@/lib/audit";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "ai_actions" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;

  let pool;
  try {
    pool = getRequestPool();
  } catch {
    return fail("unavailable", "Action policy indisponível (config).", 503, { requestId });
  }

  const { rows } = await pool.query<{ settings: Record<string, unknown> | null }>(
    `select settings from organizations where id = $1`,
    [authz.org.orgId],
  );
  const aiMode = lerAiMode(rows[0]?.settings?.ai_mode);

  const result = await confirmarPedidoDeAcao({
    db: pool,
    organizationId: authz.org.orgId,
    pedidoId: id,
    userId: authz.user.id,
    aiMode,
    executar: (pedido) => executarPedidoComoHumano(pool, pedido),
  });

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : result.reason === "denied" ? 403 : 422;
    return fail(result.reason === "not_found" ? "not_found" : "forbidden", result.message, status, {
      requestId,
    });
  }

  void audit({
    action: "ai_action.confirmed",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "ai_action_request",
    resourceId: result.pedido.id,
    requestId,
    metadata: {
      requested_action: result.pedido.requested_action,
      idempotent: result.idempotent,
    },
  });

  return ok({ request: result.pedido, idempotent: result.idempotent }, { requestId });
}
