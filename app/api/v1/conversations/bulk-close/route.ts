/**
 * POST /api/v1/conversations/bulk-close
 *
 * Só o admin da empresa. Atendente e supervisor continuam fechando uma a uma.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { encerrarFila } from "@/lib/inbox/encerrar-fila";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", {
    requestId,
    resource: "conversations",
    allowPlatformAdmin: true,
  });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  try {
    const { encerradas } = await encerrarFila(supabase, authz.org.orgId);
    await audit({
      action: "conversation.bulk_closed",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "conversation",
      resourceId: authz.org.orgId,
      requestId,
      metadata: { encerradas },
    });
    return ok({ encerradas }, { requestId });
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Não consegui encerrar a fila.",
      500,
      { requestId },
    );
  }
}
