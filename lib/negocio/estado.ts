/**
 * Estado da configuração do tenant — o que a central e o checklist leem.
 *
 * Não inventa status: WhatsApp usa a regra residual de 3B.3; o resto
 * conta linhas reais.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ehSessaoSupersedida, orgTemSessaoWorking } from "@/lib/channels/sessoes-residuais";
import { lerAiMode, type AiMode } from "@/lib/ai/execucao/modos";
import { lerPerfilDoNegocio } from "@/lib/ready-models/perfil";
import type { ReadyModelId } from "@/lib/ready-models/tipos";
import { rotuloDoModoIa, rotuloDoModelo, rotuloDoSubtipo } from "./rotulos";

export type EstadoDoCard = "ok" | "falta" | "atencao";

export interface CardDeSetup {
  id: string;
  titulo: string;
  estado: EstadoDoCard;
  resumo: string;
  href: string;
}

export interface EstadoDoSetup {
  empresa: string;
  modeloId: ReadyModelId | null;
  modeloRotulo: string;
  subtipo: string | null;
  aiMode: AiMode;
  aiModeRotulo: string;
  whatsappNumero: string | null;
  whatsappConectado: boolean;
  fontes: number;
  assistentes: number;
  assistentesPublicados: number;
  automacoesAtivas: number;
  pipeline: string | null;
  equipe: number;
  cards: CardDeSetup[];
  checklist: Array<{
    id: string;
    label: string;
    feito: boolean;
    href: string;
  }>;
}

function telefoneVisivel(phone: string | null): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (d.length < 4) return phone || "sem número";
  return `…${d.slice(-4)}`;
}

export function montarEstadoDoSetup(input: {
  empresa: string;
  settings: unknown;
  sessoes: Array<{ id: string; status: string | null; phone_number: string | null }>;
  fontes: number;
  assistentes: number;
  assistentesPublicados: number;
  automacoesAtivas: number;
  pipeline: string | null;
  equipe: number;
}): EstadoDoSetup {
  const perfil = lerPerfilDoNegocio(input.settings);
  const aiBruto =
    input.settings && typeof input.settings === "object"
      ? (input.settings as { ai_mode?: unknown }).ai_mode
      : undefined;
  const aiMode = lerAiMode(aiBruto ?? "off");
  const working = orgTemSessaoWorking(input.sessoes);
  const principal = input.sessoes.find(
    (s) => (s.status ?? "").toUpperCase() === "WORKING" && (s.phone_number ?? "").trim(),
  );
  const caidasReais = input.sessoes.filter(
    (s) =>
      (s.status === "FAILED" || s.status === "STOPPED" || s.status === "SCAN_QR_CODE") &&
      !ehSessaoSupersedida(s, input.sessoes),
  );
  const whatsappOk = working && Boolean(principal);
  const whatsappNumero = principal ? telefoneVisivel(principal.phone_number) : null;

  const cards: CardDeSetup[] = [
    {
      id: "perfil",
      titulo: "Perfil do negócio",
      estado: perfil ? "ok" : "falta",
      resumo: perfil
        ? [rotuloDoModelo(perfil.id), rotuloDoSubtipo(perfil.id, perfil.subtype)]
            .filter(Boolean)
            .join(" · ")
        : "Ainda não escolheu o tipo de negócio.",
      href: "/app/settings/perfil",
    },
    {
      id: "whatsapp",
      titulo: "WhatsApp",
      estado: whatsappOk ? "ok" : caidasReais.length > 0 ? "atencao" : "falta",
      resumo: whatsappOk
        ? `Número ${whatsappNumero} · Conectado`
        : "Nenhum número em uso.",
      href: "/app/connections",
    },
    {
      id: "conhecimento",
      titulo: "Conhecimento da empresa",
      estado: input.fontes > 0 ? "ok" : "falta",
      resumo:
        input.fontes > 0
          ? `${input.fontes} ${input.fontes === 1 ? "fonte" : "fontes"} cadastrada${input.fontes === 1 ? "" : "s"}`
          : "Ainda não ensinou o sistema sobre a empresa.",
      href: "/app/ai/knowledge/sources",
    },
    {
      id: "ia",
      titulo: "IA e assistentes",
      estado: aiMode === "off" && input.assistentesPublicados === 0 ? "falta" : "ok",
      resumo: `Modo: ${rotuloDoModoIa(aiMode)} · ${input.assistentes} ${
        input.assistentes === 1 ? "assistente" : "assistentes"
      }`,
      href: "/app/settings/atendimento",
    },
    {
      id: "automacoes",
      titulo: "Automações",
      estado: input.automacoesAtivas > 0 ? "ok" : "falta",
      resumo:
        input.automacoesAtivas > 0
          ? `${input.automacoesAtivas} ${input.automacoesAtivas === 1 ? "ativa" : "ativas"}`
          : "Nenhuma automação ligada.",
      href: "/app/ai/followups",
    },
    {
      id: "funil",
      titulo: "Funil e campos",
      estado: input.pipeline ? "ok" : "falta",
      resumo: input.pipeline ?? "Nenhum funil padrão.",
      href: "/app/settings/tenant/pipelines",
    },
    {
      id: "equipe",
      titulo: "Equipe",
      estado: input.equipe > 1 ? "ok" : "atencao",
      resumo: `${input.equipe} ${input.equipe === 1 ? "pessoa" : "pessoas"}`,
      href: "/app/team",
    },
  ];

  const checklist = [
    { id: "empresa", label: "Dados da empresa", feito: Boolean(perfil), href: "/app/settings/perfil" },
    { id: "whatsapp", label: "WhatsApp conectado", feito: whatsappOk, href: "/app/connections" },
    {
      id: "conhecimento",
      label: "Conhecimento da empresa",
      feito: input.fontes > 0,
      href: "/app/ai/knowledge/sources",
    },
    {
      id: "automacao",
      label: "Automação inicial",
      feito: input.automacoesAtivas > 0,
      href: "/app/ai/followups",
    },
    { id: "ia", label: "Configurar IA", feito: aiMode !== "off", href: "/app/settings/atendimento" },
    { id: "equipe", label: "Convidar equipe", feito: input.equipe > 1, href: "/app/team" },
  ];

  return {
    empresa: input.empresa || "Sua empresa",
    modeloId: perfil?.id ?? null,
    modeloRotulo: rotuloDoModelo(perfil?.id),
    subtipo: rotuloDoSubtipo(perfil?.id ?? null, perfil?.subtype ?? null),
    aiMode,
    aiModeRotulo: rotuloDoModoIa(aiMode),
    whatsappNumero,
    whatsappConectado: whatsappOk,
    fontes: input.fontes,
    assistentes: input.assistentes,
    assistentesPublicados: input.assistentesPublicados,
    automacoesAtivas: input.automacoesAtivas,
    pipeline: input.pipeline,
    equipe: input.equipe,
    cards,
    checklist,
  };
}

export async function carregarEstadoDoSetup(
  db: SupabaseClient,
  organizationId: string,
): Promise<EstadoDoSetup> {
  const [
    org,
    sessoes,
    fontes,
    agentes,
    fluxos,
    pipeline,
    membros,
  ] = await Promise.all([
    db.from("organizations").select("display_name, settings").eq("id", organizationId).maybeSingle(),
    db
      .from("channel_sessions")
      .select("id, status, phone_number")
      .eq("organization_id", organizationId)
      .is("archived_at", null),
    db
      .from("ai_knowledge_sources")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    db
      .from("ai_agents")
      .select("id, published_version_id")
      .eq("organization_id", organizationId)
      .is("archived_at", null),
    db
      .from("followup_flow_pointers")
      .select("id, status")
      .eq("organization_id", organizationId),
    db
      .from("crm_pipelines")
      .select("name")
      .eq("organization_id", organizationId)
      .eq("is_default", true)
      .eq("is_archived", false)
      .maybeSingle(),
    db
      .from("user_organizations")
      .select("user_id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("revoked_at", null),
  ]);

  const agentesRows = (agentes.data ?? []) as Array<{ published_version_id: string | null }>;
  const fluxosRows = (fluxos.data ?? []) as Array<{ status: string | null }>;

  return montarEstadoDoSetup({
    empresa: (org.data?.display_name as string | null) ?? "",
    settings: org.data?.settings,
    sessoes: (sessoes.data ?? []) as Array<{
      id: string;
      status: string | null;
      phone_number: string | null;
    }>,
    fontes: fontes.count ?? 0,
    assistentes: agentesRows.length,
    assistentesPublicados: agentesRows.filter((a) => a.published_version_id).length,
    automacoesAtivas: fluxosRows.filter((f) => f.status === "active").length,
    pipeline: (pipeline.data?.name as string | null) ?? null,
    equipe: membros.count ?? 0,
  });
}
