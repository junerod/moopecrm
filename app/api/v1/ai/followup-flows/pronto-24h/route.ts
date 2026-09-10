/**
 * POST /api/v1/ai/followup-flows/pronto-24h — liga o lembrete de 24h existente.
 *
 * Não cria motor novo. Publica o grafo de silêncio pelo publish já usado
 * pelo Ready Model. AI_MODE OFF não impede: o envio é determinístico.
 */
import { randomUUID } from "node:crypto";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { ativarFollowup24h } from "@/lib/negocio/followup-24h";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "followup_flows" });
  if (!authz.ok) return authz.response;

  try {
    const r = await ativarFollowup24h(createAdminClient(), authz.org.orgId, authz.user.id);
    void audit({
      action: "followup_flow.published",
      actorUserId: authz.user.id,
      organizationId: authz.org.orgId,
      resourceType: "followup_flow_pointer",
      resourceId: r.id,
      requestId,
      metadata: { pronto: "silencio-24h", ja_estava_ativo: r.jaEstavaAtivo },
    });
    return ok({ id: r.id, ja_estava_ativo: r.jaEstavaAtivo }, { requestId });
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Não consegui ligar o lembrete.",
      500,
      { requestId },
    );
  }
}
