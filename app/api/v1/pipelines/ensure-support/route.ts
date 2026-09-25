/**
 * POST /api/v1/pipelines/ensure-support
 *
 * Garante o funil "Suporte" na org ativa (idempotente). Manager+.
 */
import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { garantirFunilSuporte } from "@/lib/pipelines/garantir-funil-suporte";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "crm_pipelines" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  try {
    const result = await garantirFunilSuporte(supabase, authz.org.orgId);
    if (result.criado) {
      void audit({
        action: "pipeline.created",
        actorUserId: authz.user.id,
        organizationId: authz.org.orgId,
        resourceType: "crm_pipeline",
        resourceId: result.pipelineId,
        requestId,
        metadata: { template: "suporte", name: "Suporte" },
      });
    }
    return ok(
      {
        pipeline_id: result.pipelineId,
        created: result.criado,
      },
      { status: result.criado ? 201 : 200, requestId },
    );
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Falha ao garantir funil Suporte.",
      500,
      { requestId },
    );
  }
}
