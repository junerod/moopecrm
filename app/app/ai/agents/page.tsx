import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { especialidadeDoAgente, packEstaAtivo } from "@/lib/business-packs/apresentacao";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { AgentRow } from "@/hooks/ai/useAgent";

import { AgentsList } from "./_components/AgentsList";
import { LandingAssistentes, type CardAssistente } from "./_components/LandingAssistentes";

export const dynamic = "force-dynamic";

/**
 * `versao_publicada` vem por join porque `ai_agents.model` é o valor do CADASTRO:
 * para `mcp_agent`, quem responde é `ai_agent_versions.model` da versão publicada,
 * e publicar não sincroniza a coluna de cima. Sem este join a lista anunciaria
 * para sempre o modelo escolhido no dia da criação.
 */
const AGENT_COLUMNS =
  "id, organization_id, name, description, model, system_prompt, is_active, is_default, kind, priority, published_version_id, archived_at, config, guardrails, active_kb_version_id, created_at, updated_at, " +
  "versao_publicada:ai_agent_versions!ai_agents_published_version_id_fkey(provider, model)";

export default async function AgentsListPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_agents")
    .select(AGENT_COLUMNS)
    .eq("organization_id", activeOrg.orgId)
    .order("created_at", { ascending: false });

  if (error) {
    logger.error("[ai/agents] não consegui listar os agentes — a tela vai parecer vazia", {
      organization_id: activeOrg.orgId,
      detail: error.message.slice(0, 200),
    });
  }

  const agents = (data ?? []) as unknown as AgentRow[];
  const canWrite = ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin;
  const [{ data: org }, { count: credenciaisCount }] = await Promise.all([
    supabase
      .from("organizations")
      .select("settings")
      .eq("id", activeOrg.orgId)
      .maybeSingle(),
    supabase
      .from("ai_provider_credentials_safe")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrg.orgId),
  ]);
  const semCredencialIa = (credenciaisCount ?? 0) === 0;
  const pack = lerPackGravado(org?.settings);
  const definition = pack ? resolverPack(pack.id) : null;

  const cards: CardAssistente[] = agents.map((a) => {
    const spec = especialidadeDoAgente(a, definition);
    const ativo = a.kind === "mcp_agent" ? Boolean(a.published_version_id) && !a.archived_at : a.is_active && !a.archived_at;
    return {
      id: a.id,
      name: a.name,
      description: a.description ?? spec?.description ?? "Assistente da empresa",
      ativo,
      specialtyKey: spec?.key ?? null,
      principal: Boolean(spec?.isPrincipal),
      jaExistia: !spec,
    };
  });

  // Ativos primeiro (quem opera quer ver o que está no ar). Dentro do mesmo
  // estado, a ordem do pack — senão a Recepção some no meio dos inativos.
  {
    const ordem = definition
      ? new Map(definition.specialties.map((s, i) => [s.key, i]))
      : null;
    cards.sort((a, b) => {
      if (a.ativo !== b.ativo) return a.ativo ? -1 : 1;
      if (ordem) {
        const ia = a.specialtyKey ? (ordem.get(a.specialtyKey) ?? 100) : 200;
        const ib = b.specialtyKey ? (ordem.get(b.specialtyKey) ?? 100) : 200;
        return ia - ib;
      }
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-[var(--color-bg)] p-6">
      <LandingAssistentes
        packAtivo={packEstaAtivo(pack)}
        packLabel={definition?.label ?? null}
        packId={definition?.id ?? null}
        cards={cards}
        canWrite={canWrite}
        semCredencialIa={semCredencialIa}
      />

      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">Avançado</summary>
        <div className="mt-4">
          <AgentsList initialData={agents} canWrite={canWrite} />
        </div>
      </details>
    </div>
  );
}
