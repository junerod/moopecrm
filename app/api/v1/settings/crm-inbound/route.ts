/**
 * GET/PATCH /api/v1/settings/crm-inbound — funil onde conversa nova vira lead.
 *
 * Merge não-destrutivo de `organizations.settings.crm`. Não mistura com
 * `is_default` (padrão técnico) nem com Ready Model / AI.
 *
 * null = voltar ao fallback `is_default`. Id tem de ser funil da MESMA org,
 * não arquivado, com etapa aberta — senão 404, não grava.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { ApiError } from "@/lib/api/types";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import {
  lerInboundPipelineId,
  mesclarCrmSettings,
  pipelineUtilizavelParaNascimento,
  resolverFunilDeNascimento,
} from "@/lib/leads/funil-de-nascimento";
import { crmInboundPatchSchema } from "@/lib/schemas/settings";
import { validateRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function lerEstado(orgId: string) {
  const supabase = await createClient();
  const { data: orgRow, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw error;

  const settings = (orgRow?.settings as Record<string, unknown> | null) ?? {};
  const inbound_pipeline_id = lerInboundPipelineId(settings);
  const destino = await resolverFunilDeNascimento(supabase, orgId);
  if ("erro" in destino) {
    return {
      inbound_pipeline_id,
      resolved_pipeline_id: null,
      resolved_stage_id: null,
      resolved_via: "none" as const,
    };
  }
  const resolved_via =
    inbound_pipeline_id && inbound_pipeline_id === destino.pipelineId
      ? ("inbound" as const)
      : ("default" as const);
  return {
    inbound_pipeline_id,
    resolved_pipeline_id: destino.pipelineId,
    resolved_stage_id: destino.stageId,
    resolved_via,
  };
}

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "settings_crm_inbound" });
  if (!authz.ok) return authz.response;
  try {
    return ok(await lerEstado(authz.org.orgId), { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "falha ao ler funil de novos leads";
    return fail("internal_error", message, 500, { requestId });
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "settings_crm_inbound" });
  if (!authz.ok) return authz.response;

  let input;
  try {
    input = await validateRequest(crmInboundPatchSchema, req);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }

  const supabase = createAdminClient();
  if (input.inbound_pipeline_id) {
    const valido = await pipelineUtilizavelParaNascimento(
      supabase,
      authz.org.orgId,
      input.inbound_pipeline_id,
    );
    if (!valido) {
      return fail(
        "not_found",
        "Esse funil não existe nesta organização, está arquivado ou não tem etapa aberta.",
        404,
        { requestId },
      );
    }
  }

  const { data: orgRow, error: readErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (readErr) return fail("internal_error", readErr.message, 500, { requestId });

  const current = (orgRow?.settings as Record<string, unknown> | null) ?? {};
  const next = mesclarCrmSettings(current, input.inbound_pipeline_id);

  const { error: updErr } = await supabase
    .from("organizations")
    .update({ settings: next })
    .eq("id", authz.org.orgId);
  if (updErr) return fail("internal_error", updErr.message, 500, { requestId });

  void audit({
    action: "crm.inbound_pipeline_changed",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "organization",
    resourceId: authz.org.orgId,
    requestId,
    metadata: { inbound_pipeline_id: input.inbound_pipeline_id },
  });

  try {
    return ok(await lerEstado(authz.org.orgId), { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "salvo, mas a leitura falhou";
    return fail("internal_error", message, 500, { requestId });
  }
}
