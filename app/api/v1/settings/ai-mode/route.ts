/**
 * GET/PATCH /api/v1/settings/ai-mode — modo da IA da organização (manager+).
 * Merge não-destrutivo de `organizations.settings`. Não mistura com routing.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { ApiError } from "@/lib/api/types";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import {
  globalAiExecutionOff,
  modoApresentado,
  resolveAiExecutionPolicy,
} from "@/lib/ai/execucao/politica";
import { lerAiMode } from "@/lib/ai/execucao/modos";
import { lerActionPolicy } from "@/lib/ai/acoes/autorizar";
import { aiModePatchSchema } from "@/lib/schemas/settings";
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
  const configured = lerAiMode(settings.ai_mode);
  const action_policy = lerActionPolicy(settings.ai_action_policy);

  const admin = createAdminClient();
  const { count } = await admin
    .from("ai_agents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("archived_at", null)
    .not("published_version_id", "is", null);

  const politica = resolveAiExecutionPolicy({
    globalOff: globalAiExecutionOff(),
    tenantMode: configured,
    channelOff: false,
    agentOff: false,
    conversationDeny: null,
  });

  return {
    configured,
    effective: modoApresentado(politica),
    kill_global: politica.kill_source === "global",
    kill_source: politica.kill_source,
    reason: politica.reason,
    agent_published: (count ?? 0) > 0,
    suggestion_allowed: politica.suggestion_allowed,
    action_policy,
  };
}

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "settings_ai_mode" });
  if (!authz.ok) return authz.response;
  try {
    return ok(await lerEstado(authz.org.orgId), { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "falha ao ler modo da IA";
    return fail("internal_error", message, 500, { requestId });
  }
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "settings_ai_mode" });
  if (!authz.ok) return authz.response;

  let input;
  try {
    input = await validateRequest(aiModePatchSchema, req);
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
  const { data: orgRow, error: readErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", authz.org.orgId)
    .maybeSingle();
  if (readErr) return fail("internal_error", readErr.message, 500, { requestId });

  const current = (orgRow?.settings as Record<string, unknown> | null) ?? {};
  const next: Record<string, unknown> = { ...current, ai_mode: input.ai_mode };
  if (input.ai_action_policy) next.ai_action_policy = input.ai_action_policy;

  const { error: updErr } = await supabase
    .from("organizations")
    .update({ settings: next })
    .eq("id", authz.org.orgId);
  if (updErr) return fail("internal_error", updErr.message, 500, { requestId });

  void audit({
    action: "ai_mode.config_changed",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "organization",
    resourceId: authz.org.orgId,
    requestId,
    metadata: { ai_mode: input.ai_mode, ai_action_policy: input.ai_action_policy ?? null },
  });

  try {
    return ok(await lerEstado(authz.org.orgId), { requestId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "salvo, mas a leitura falhou";
    return fail("internal_error", message, 500, { requestId });
  }
}
