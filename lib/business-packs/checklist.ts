/**
 * Checklist pós-ativação — lê o tenant. Não grava checkbox.
 * Funciona para qualquer Pack: inspeciona artifacts, não o id do nicho.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { packEstaAtivo } from "@/lib/business-packs/apresentacao";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import type { BusinessPackGravado } from "@/lib/business-packs/tipos";
import { orgTemSessaoWorking } from "@/lib/channels/sessoes-residuais";
import { idsDeColecaoDoMeta } from "@/lib/ai/knowledge/colecoes";

export const ITENS_DO_CHECKLIST = ["whatsapp", "knowledge", "assistentes", "automacao"] as const;
export type IdDoItemDoChecklist = (typeof ITENS_DO_CHECKLIST)[number];

export type ItemDoChecklist = {
  id: IdDoItemDoChecklist;
  titulo: string;
  descricao: string;
  feito: boolean;
  status: string;
  href: string;
  cta: string;
};

export type ChecklistDoPack = {
  packId: string;
  packLabel: string;
  concluidos: number;
  total: 4;
  pronto: boolean;
  itens: ItemDoChecklist[];
};

export type FonteParaChecklist = {
  is_active: boolean | null;
  status: string | null;
  source_metadata: unknown;
};

export type AgenteParaChecklist = {
  id: string;
  published_version_id: string | null;
};

export type AutomacaoParaChecklist = {
  id: string;
  is_active: boolean | null;
};

export type FluxoParaChecklist = {
  id: string;
  status: string | null;
};

export type SessaoParaChecklist = {
  id: string;
  status: string | null;
  phone_number: string | null;
};

export function montarChecklistDoPack(input: {
  pack: BusinessPackGravado | null;
  packLabel?: string | null;
  sessoes: SessaoParaChecklist[];
  fontes: FonteParaChecklist[];
  agentes: AgenteParaChecklist[];
  automacoes: AutomacaoParaChecklist[];
  fluxos?: FluxoParaChecklist[];
}): ChecklistDoPack | null {
  if (!packEstaAtivo(input.pack) || !input.pack) return null;

  const pack = input.pack;
  const working = orgTemSessaoWorking(input.sessoes);
  const comNumero = input.sessoes.some(
    (s) => (s.status ?? "").toUpperCase() === "WORKING" && (s.phone_number ?? "").trim(),
  );
  const whatsappOk = working && comNumero;

  const colecoesDoPack = Object.values(pack.artifacts.collection_slugs);
  const knowledgeOk = fonteAtivaDoPack(input.fontes, colecoesDoPack);

  const agentIds = Object.values(pack.artifacts.agent_keys);
  const agentesDoPack = input.agentes.filter((a) => agentIds.includes(a.id));
  const publicados = agentesDoPack.filter((a) => Boolean(a.published_version_id)).length;
  const totalAgentes = agentIds.length;
  const assistentesOk = totalAgentes > 0 && publicados === totalAgentes;

  const autoIds = Object.values(pack.artifacts.automation_keys);
  const autosDoPack = input.automacoes.filter((a) => autoIds.includes(a.id));
  const regrasAtivas = autosDoPack.filter((a) => a.is_active === true).length;
  const fluxoIds = Object.values(pack.artifacts.followup_keys);
  const fluxosDoPack = (input.fluxos ?? []).filter((f) => fluxoIds.includes(f.id));
  const fluxosAtivos = fluxosDoPack.filter((f) => f.status === "active").length;
  const ativas = regrasAtivas + fluxosAtivos;
  const automacaoOk = ativas > 0;

  const itens: ItemDoChecklist[] = [
    {
      id: "whatsapp",
      titulo: "Conecte seu WhatsApp",
      descricao: "Use seu número para receber e responder clientes.",
      feito: whatsappOk,
      status: whatsappOk ? "Conectado" : "Não conectado",
      href: "/app/connections",
      cta: "Conectar WhatsApp",
    },
    {
      id: "knowledge",
      titulo: "Ensine seus assistentes",
      descricao: "Envie regras, serviços, preços, procedimentos e materiais da sua empresa.",
      feito: knowledgeOk,
      status: knowledgeOk ? "Material na pasta do modelo" : "Nenhum material nas pastas do modelo",
      href: "/app/ai/knowledge/sources",
      cta: "Adicionar conhecimento",
    },
    {
      id: "assistentes",
      titulo: "Publique seus assistentes",
      descricao: "Revise as instruções e publique quando estiver pronto.",
      feito: assistentesOk,
      status: `${publicados} de ${totalAgentes} publicados`,
      href: "/app/ai/agents",
      cta: "Ver assistentes",
    },
    {
      id: "automacao",
      titulo: "Ative sua primeira automação",
      descricao: "Escolha um fluxo pronto, revise o texto e ligue quando estiver seguro.",
      feito: automacaoOk,
      status: ativas === 0 ? "Nenhuma ativa" : ativas === 1 ? "1 ativa" : `${ativas} ativas`,
      href: "/app/meu-modelo#fluxos-prontos",
      cta: "Ver fluxos prontos",
    },
  ];

  const concluidos = itens.filter((i) => i.feito).length;
  const label =
    input.packLabel?.trim() ||
    resolverPack(pack.id)?.label ||
    pack.id;

  return {
    packId: pack.id,
    packLabel: label,
    concluidos,
    total: 4,
    pronto: concluidos === 4,
    itens,
  };
}

/** Fonte ativa nas coleções do Pack. Fonte genérica sem coleção não conta. */
export function fonteAtivaDoPack(
  fontes: FonteParaChecklist[],
  colecoesDoPack: string[],
): boolean {
  const ativas = fontes.filter(
    (f) => f.is_active !== false && (f.status ?? "ready") !== "archived",
  );
  if (ativas.length === 0) return false;
  if (colecoesDoPack.length === 0) return true;
  return ativas.some((f) => {
    const meta = f.source_metadata && typeof f.source_metadata === "object"
      ? (f.source_metadata as Record<string, unknown>)
      : {};
    const ids = idsDeColecaoDoMeta(meta);
    return ids.some((id) => colecoesDoPack.includes(id));
  });
}

export async function carregarChecklistDoPack(
  db: SupabaseClient,
  organizationId: string,
): Promise<ChecklistDoPack | null> {
  const { data: org } = await db
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();
  const pack = lerPackGravado(org?.settings);
  if (!pack || !packEstaAtivo(pack)) return null;

  const agentIds = Object.values(pack.artifacts.agent_keys);
  const autoIds = Object.values(pack.artifacts.automation_keys);
  const fluxoIds = Object.values(pack.artifacts.followup_keys);

  const [sessoes, fontes, agentes, automacoes, fluxos] = await Promise.all([
    db
      .from("channel_sessions")
      .select("id, status, phone_number")
      .eq("organization_id", organizationId)
      .is("archived_at", null),
    db
      .from("ai_knowledge_sources")
      .select("is_active, status, source_metadata")
      .eq("organization_id", organizationId),
    agentIds.length > 0
      ? db
          .from("ai_agents")
          .select("id, published_version_id")
          .eq("organization_id", organizationId)
          .in("id", agentIds)
          .is("archived_at", null)
      : Promise.resolve({ data: [] as AgenteParaChecklist[] }),
    autoIds.length > 0
      ? db
          .from("automation_rules")
          .select("id, is_active")
          .eq("organization_id", organizationId)
          .in("id", autoIds)
      : Promise.resolve({ data: [] as AutomacaoParaChecklist[] }),
    fluxoIds.length > 0
      ? db
          .from("followup_flow_pointers")
          .select("id, status")
          .eq("organization_id", organizationId)
          .in("id", fluxoIds)
      : Promise.resolve({ data: [] as FluxoParaChecklist[] }),
  ]);

  return montarChecklistDoPack({
    pack,
    packLabel: resolverPack(pack.id)?.label ?? null,
    sessoes: (sessoes.data ?? []) as SessaoParaChecklist[],
    fontes: (fontes.data ?? []) as FonteParaChecklist[],
    agentes: (agentes.data ?? []) as AgenteParaChecklist[],
    automacoes: (automacoes.data ?? []) as AutomacaoParaChecklist[],
    fluxos: (fluxos.data ?? []) as FluxoParaChecklist[],
  });
}
