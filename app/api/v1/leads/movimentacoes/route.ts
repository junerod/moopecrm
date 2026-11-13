/**
 * GET /api/v1/leads/movimentacoes — mudanças de etapa das últimas 48h.
 *
 * Alimenta o sino. A Início lê a mesma função via snapshot.
 * organization_id vem do cookie, nunca do query.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { ehGestor } from "@/lib/home/tipos";
import { listarMovimentacoesDoFunil } from "@/lib/home/movimentacoes-funil";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "leads" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  try {
    const data = await listarMovimentacoesDoFunil(supabase, {
      organizationId: authz.org.orgId,
      userId: authz.user.id,
      soDoDono: !ehGestor(authz.org.role),
    });
    return ok(data, { requestId });
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Não foi possível ler as alterações do funil.",
      500,
      { requestId },
    );
  }
}
