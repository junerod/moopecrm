"use server";

import { audit } from "@/lib/audit";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  garantirAgenteAtendimentoLocadora,
  NOME_AGENTE_ATENDIMENTO_LOCADORA,
  preencherExemploSePelado,
} from "@/lib/moope/agente-atendimento-locadora";
import {
  ferramentasDoExemploEstaoPeladas,
  promptDoExemploEstaPelado,
} from "@/lib/moope/exemplo-assistente-locadora";
import { createAdminClient } from "@/lib/supabase/admin";

export type AssistenteLocadoraCriado = {
  ok: true;
  agent_id: string;
  name: string;
  publicado: boolean;
  message: string;
};

export type AssistenteLocadoraRecusado = { ok: false; message: string };

/**
 * Cria (ou devolve) o assistente "Atendimento locadora" para o bloco do bot.
 * A org sai da sessão. Sem Moope ligada, não inventa um agente.
 */
export async function garantirAssistenteLocadoraAction(): Promise<
  AssistenteLocadoraCriado | AssistenteLocadoraRecusado
> {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org || ROLE_RANK[org.role] < ROLE_RANK.manager) {
    return { ok: false, message: "Só quem administra a empresa cria este assistente." };
  }

  const admin = createAdminClient();
  const { data: ja } = await admin
    .from("ai_agents")
    .select("id, published_version_id")
    .eq("organization_id", org.orgId)
    .eq("name", NOME_AGENTE_ATENDIMENTO_LOCADORA)
    .is("archived_at", null)
    .maybeSingle();

  if (ja?.id) {
    const { data: ver } = await admin
      .from("ai_agent_versions")
      .select("system_prompt, tool_ids")
      .eq("organization_id", org.orgId)
      .eq("agent_id", ja.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const linha = ver as { system_prompt?: string; tool_ids?: string[] } | null;
    const pelado =
      !linha ||
      promptDoExemploEstaPelado(linha.system_prompt) ||
      ferramentasDoExemploEstaoPeladas(linha.tool_ids);
    const gravou = pelado
      ? await preencherExemploSePelado(admin, org.orgId, user.id, ja.id)
      : false;
    if (gravou) {
      await audit({
        action: "ai_agent.version_created",
        actorUserId: user.id,
        organizationId: org.orgId,
        resourceType: "ai_agent",
        resourceId: ja.id,
        metadata: { origem: "exemplo_locadora" },
        bypassedRls: true,
      });
    }
    const { data: deNovo } = await admin
      .from("ai_agents")
      .select("id, published_version_id")
      .eq("organization_id", org.orgId)
      .eq("id", ja.id)
      .maybeSingle();
    const publicado = Boolean(deNovo?.published_version_id ?? ja.published_version_id);
    return {
      ok: true,
      agent_id: ja.id,
      name: NOME_AGENTE_ATENDIMENTO_LOCADORA,
      publicado,
      message: gravou
        ? "Preenchi o exemplo da locadora: tom, boleto, contrato, ofertas e quando chamar uma pessoa. Revise e publique se ainda estiver em rascunho."
        : pelado
          ? "O exemplo está na ficha. Falta canal ou modelo para gravar a versão — abra Assistentes de IA e salve."
          : publicado
          ? "Este assistente já existe e está publicado. Pode usar neste bloco."
          : "Este assistente existe, mas ainda não está publicado. Abra Assistentes de IA e publique.",
    };
  }

  const criado = await garantirAgenteAtendimentoLocadora(admin, org.orgId, user.id);
  if (!criado.ok || !criado.agent_id) {
    return {
      ok: false,
      message: "A Moope não está ligada nesta empresa. Ligue em Integrações e tente de novo.",
    };
  }

  const publicado = criado.status === "published";
  await audit({
    action: publicado ? "ai_agent.published" : "ai_agent.created",
    actorUserId: user.id,
    organizationId: org.orgId,
    resourceType: "ai_agent",
    resourceId: criado.agent_id,
    metadata: { origem: "bot_locadora", status: criado.status ?? "draft" },
    bypassedRls: true,
  });

  return {
    ok: true,
    agent_id: criado.agent_id,
    name: NOME_AGENTE_ATENDIMENTO_LOCADORA,
    publicado,
    message: publicado
      ? "Atendimento da locadora criado, preenchido (boleto, contrato, ofertas e quando chamar uma pessoa) e publicado."
      : "Criei o exemplo preenchido, mas faltou canal, modelo ou chave para publicar. Abra Assistentes de IA — o texto já está na ficha.",
  };
}
