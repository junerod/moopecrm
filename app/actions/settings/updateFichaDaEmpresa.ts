"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/audit";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { mesclarSettingsEmpresa } from "@/lib/negocio/ficha";
import { fichaDaEmpresaSchema, type FichaDaEmpresaInput } from "@/lib/schemas/settings";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type UpdateFichaDaEmpresaResult =
  | { ok: true }
  | { ok: false; error: string; details?: unknown };

export async function updateFichaDaEmpresa(
  input: FichaDaEmpresaInput,
): Promise<UpdateFichaDaEmpresaResult> {
  const parsed = fichaDaEmpresaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "validation_failed", details: parsed.error.flatten() };
  }

  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "forbidden_tenant" };
  if (!authUser.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    return { ok: false, error: "forbidden_role" };
  }

  const supabase = createAdminClient();
  const hdrs = await headers();
  const requestId = hdrs.get("x-request-id");
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = hdrs.get("user-agent") ?? null;

  const { data: orgRow, error: readErr } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();
  if (readErr) return { ok: false, error: readErr.message };

  const atuais = (orgRow?.settings as Record<string, unknown> | null) ?? {};
  const nextSettings = mesclarSettingsEmpresa(atuais, parsed.data.empresa);

  const { error } = await supabase
    .from("organizations")
    .update({
      display_name: parsed.data.display_name,
      legal_name: parsed.data.legal_name,
      cnpj: parsed.data.cnpj ?? null,
      settings: nextSettings,
    })
    .eq("id", activeOrg.orgId);
  if (error) return { ok: false, error: error.message };

  await audit({
    action: "org.updated",
    actorUserId: authUser.id,
    organizationId: activeOrg.orgId,
    resourceType: "organization",
    resourceId: activeOrg.orgId,
    requestId,
    ip,
    userAgent,
    metadata: { origem: "ficha_da_empresa", fields_changed: Object.keys(parsed.data) },
  });

  await supabase
    .rpc("emit_event", {
      p_event_type: "org.updated",
      p_entity_kind: "organization",
      p_entity_id: activeOrg.orgId,
      p_payload: { organization_id: activeOrg.orgId },
      p_metadata: { request_id: requestId },
      p_organization_id: activeOrg.orgId,
    })
    .then(({ error: e }) => {
      if (e) logger.error("[updateFichaDaEmpresa] emit_event failed", { detail: e.message });
    });

  revalidatePath("/app/settings/business");
  revalidatePath("/app/settings/tenant");
  return { ok: true };
}
