"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { aplicarPerfilDoNegocio, IDS_DE_PERFIL } from "@/lib/onboarding/aplicar-perfil";
import { LOCACAO_SUBTYPES } from "@/lib/ready-models/tipos";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  perfil: z.enum(IDS_DE_PERFIL as [string, ...string[]]),
  subtype: z.enum(LOCACAO_SUBTYPES).optional(),
});

export type AplicarPerfilResult =
  | { ok: true; criouQuadroNovo: boolean; pipelinePadraoId: string }
  | { ok: false; error: string };

export async function aplicarPerfilAction(input: unknown): Promise<AplicarPerfilResult> {
  const parsed = bodySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Perfil inválido." };

  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "forbidden_tenant" };
  if (!authUser.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    return { ok: false, error: "forbidden_role" };
  }

  const admin = createAdminClient();
  try {
    const r = await aplicarPerfilDoNegocio(admin, activeOrg.orgId, parsed.data.perfil, {
      subtype: parsed.data.subtype,
      actorUserId: authUser.id,
    });
    const hdrs = await headers();
    await audit({
      action: "org.perfil_aplicado",
      actorUserId: authUser.id,
      organizationId: activeOrg.orgId,
      resourceType: "organization",
      resourceId: activeOrg.orgId,
      requestId: hdrs.get("x-request-id"),
      metadata: {
        perfil: r.perfil,
        pipeline_id: r.pipelinePadraoId,
        criou_quadro_novo: r.criouQuadroNovo,
      },
    });
    revalidatePath("/app/settings/perfil");
    revalidatePath("/app/kanban");
    revalidatePath("/app/pipelines");
    return {
      ok: true,
      criouQuadroNovo: r.criouQuadroNovo,
      pipelinePadraoId: r.pipelinePadraoId,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Não apliquei o perfil.",
    };
  }
}
