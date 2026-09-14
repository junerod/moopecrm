/**
 * Liga ou desliga o pack já instalado.
 * Não apaga agente, funil, coleção nem template. Só muda `is_active`
 * dos artefatos do pack e o `status` no JSONB.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { lerPackGravado } from "@/lib/business-packs/perfil";
import { CHAVE_PACK, type BusinessPackGravado } from "@/lib/business-packs/tipos";

export async function definirEstadoDoPack(
  admin: SupabaseClient,
  orgId: string,
  ativo: boolean,
): Promise<BusinessPackGravado> {
  const settings = await lerSettings(admin, orgId);
  const gravado = lerPackGravado(settings);
  if (!gravado) throw new Error("pack não instalado");

  const agentIds = Object.values(gravado.artifacts.agent_keys);
  if (agentIds.length > 0) {
    const { error } = await admin
      .from("ai_agents")
      .update({ is_active: ativo } as never)
      .eq("organization_id", orgId)
      .in("id", agentIds);
    if (error) throw new Error(`estado dos assistentes: ${error.message}`);
  }

  const autoIds = Object.values(gravado.artifacts.automation_keys);
  if (!ativo && autoIds.length > 0) {
    const { error } = await admin
      .from("automation_rules")
      .update({ is_active: false } as never)
      .eq("organization_id", orgId)
      .in("id", autoIds);
    if (error) throw new Error(`estado das automações: ${error.message}`);
  }

  const pack: BusinessPackGravado = {
    ...gravado,
    status: ativo ? "active" : "inactive",
  };
  await gravarPack(admin, orgId, settings, pack);
  return pack;
}

async function lerSettings(
  admin: SupabaseClient,
  orgId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(`ler settings: ${error.message}`);
  const raw = data?.settings;
  return raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
}

async function gravarPack(
  admin: SupabaseClient,
  orgId: string,
  settings: Record<string, unknown>,
  pack: BusinessPackGravado,
): Promise<void> {
  const { error } = await admin
    .from("organizations")
    .update({ settings: { ...settings, [CHAVE_PACK]: pack } } as never)
    .eq("id", orgId);
  if (error) throw new Error(`gravar pack: ${error.message}`);
}
