import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import type { AgentRow } from "@/hooks/ai/useAgent";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AgentsList } from "./_components/AgentsList";
import { logger } from "@/lib/logger";
import { rotuloDoModoIa } from "@/lib/negocio/rotulos";
import { lerAiMode } from "@/lib/ai/execucao/modos";

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

  // Sem ler o `error`, "não consegui perguntar" e "você não tem agente nenhum"
  // pintam a MESMA tela — e a segunda é uma afirmação forte sobre o trabalho de
  // quem instalou. O join por nome de constraint (`versao_publicada`) acrescentou
  // uma causa nova de erro a esta consulta, então a distinção passou a importar.
  // Degradar para lista vazia continua sendo o comportamento (a tela não pode
  // quebrar), mas agora deixa rastro.
  if (error) {
    logger.error("[ai/agents] não consegui listar os agentes — a tela vai parecer vazia", {
      organization_id: activeOrg.orgId,
      detail: error.message.slice(0, 200),
    });
  }

  const agents = (data ?? []) as unknown as AgentRow[];
  const canWrite = ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin;
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();
  const aiMode = lerAiMode((org?.settings as { ai_mode?: unknown } | null)?.ai_mode ?? "off");

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meus Assistentes</h1>
          <p className="text-sm text-muted-foreground">
            Quem ajuda no atendimento. Um assistente novo nasce desligado até
            você ativar.
          </p>
        </div>
        {canWrite ? (
          <Button asChild>
            <Link href="/app/ai/agents/simples">Criar assistente</Link>
          </Button>
        ) : null}
      </header>

      <ul className="grid gap-3 md:grid-cols-2" data-testid="meus-assistentes">
        {agents.map((a) => {
          const status = a.archived_at
            ? "archived"
            : a.published_version_id
              ? "published"
              : "draft";
          return (
            <li key={a.id} className="rounded-lg border border-border p-4 text-sm">
              <p className="font-medium">{a.name}</p>
              <p className="text-muted-foreground">Conhecimento: Empresa</p>
              <p className="text-muted-foreground">Modo: {rotuloDoModoIa(aiMode)}</p>
              <p data-testid={`assistente-status-${a.id}`}>
                Status: {status === "published" ? "Ativo" : status === "draft" ? "Rascunho" : status}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={`/app/ai/agents/${a.id}`} className="underline">
                  Editar
                </Link>
                {status === "draft" ? (
                  <Link href={`/app/ai/agents/${a.id}`} className="underline">
                    Ativar
                  </Link>
                ) : (
                  <Link href={`/app/ai/agents/${a.id}`} className="underline">
                    Desativar
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">Avançado</summary>
        <div className="mt-4">
          <AgentsList initialData={agents} canWrite={canWrite} />
        </div>
      </details>
    </div>
  );
}
