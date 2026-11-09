/**
 * Admin define a senha de quem entra no tenant.
 *
 * A troca da PRÓPRIA senha mora em Segurança (`alterarSenhaDaConta`).
 * Aqui o ator é outro: o admin da empresa ou o admin da plataforma.
 * A senha nunca entra no audit — só quem e de quem.
 */
import type { createAdminClient } from "@/lib/supabase/admin";

import { audit } from "@/lib/audit";

type Admin = ReturnType<typeof createAdminClient>;

export type FalhaAoDefinirSenha =
  | { ok: false; code: "not_found"; message: string }
  | { ok: false; code: "state_conflict"; message: string }
  | { ok: false; code: "update_failed"; message: string };

export type OkAoDefinirSenha = { ok: true };

export async function definirSenhaDeMembro(
  admin: Admin,
  args: {
    organizationId: string;
    targetUserId: string;
    actorUserId: string;
    password: string;
    origem: "platform" | "tenant";
    requestId?: string | null;
  },
): Promise<OkAoDefinirSenha | FalhaAoDefinirSenha> {
  if (args.actorUserId === args.targetUserId) {
    return {
      ok: false,
      code: "state_conflict",
      message: "A sua senha se troca em Segurança.",
    };
  }

  const { data: membro, error: membroErr } = await admin
    .from("user_organizations")
    .select("user_id, revoked_at")
    .eq("organization_id", args.organizationId)
    .eq("user_id", args.targetUserId)
    .maybeSingle();
  if (membroErr) {
    return { ok: false, code: "update_failed", message: membroErr.message };
  }
  if (!membro || membro.revoked_at) {
    return { ok: false, code: "not_found", message: "Esta pessoa não entra neste tenant." };
  }

  const { data: alvo, error: alvoErr } = await admin.auth.admin.getUserById(args.targetUserId);
  if (alvoErr || !alvo.user) {
    return { ok: false, code: "not_found", message: "Usuário não encontrado." };
  }

  const { error } = await admin.auth.admin.updateUserById(args.targetUserId, {
    password: args.password,
    app_metadata: {
      ...(alvo.user.app_metadata ?? {}),
      must_change_password: true,
    },
  });
  if (error) {
    return { ok: false, code: "update_failed", message: error.message };
  }

  void audit({
    action: "auth.password_set_by_admin",
    actorUserId: args.actorUserId,
    organizationId: args.organizationId,
    actingAsPlatformAdmin: args.origem === "platform",
    bypassedRls: true,
    resourceType: "user",
    resourceId: args.targetUserId,
    requestId: args.requestId ?? undefined,
    metadata: { origem: args.origem },
  });

  return { ok: true };
}
