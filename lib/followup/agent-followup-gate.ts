/**
 * Gate de gatilho AUTOMÁTICO de follow-up (Task 7.2) + resolução do agente que
 * ARMA o pointer (Task 8.6).
 *
 * Este módulo RESOLVE o agente que arma o pointer. A decisão de enrollar
 * automática NÃO vive mais só neste booleano: `decidirArmacaoAutomatica`
 * (fluxo-requer-ia.ts) classifica o grafo. Fluxo com IA ainda exige um
 * agente publicado com `followup.enabled=true` e o pointer em
 * `followup.flow_pointer_ids`. Fluxo determinístico (template) enrolla
 * sem agente. Enrollment MANUAL (`POST /api/v1/ai/followups/enrollments`)
 * NÃO passa por este gate — é escolha explícita de um humano.
 *
 * Task 8.6: além do booleano, o consumidor (silence-sweep) precisa saber QUAL
 * agente pinar no enrollment. `resolveAgentForAutomaticTrigger` devolve o
 * agent_id — determinístico quando >1 agente publicado habilita o mesmo
 * pointer: MENOR agent_id (uuid asc). Escolha estável, sem depender de uma
 * coluna `published_at` (que a tabela não tem por versão publicada) e sem
 * ambiguidade; documentada e testada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Um agente publicado da org com follow-up habilitado + os pointers que ele arma. */
export interface EnabledFollowupAgent {
  agentId: string;
  pointerIds: string[];
}

/** Interface estreita de DB — mesma doutrina de `AdminClient`/`ReactivityAdminClient`
 *  (narrow por consumidor, não `SupabaseClient` direto, pra ficar testável sem Postgres). */
export interface FollowupGateDb {
  /** Agentes publicados da org com `followup.enabled=true`, cada um com seus `flow_pointer_ids`. */
  loadEnabledPublishedFollowupAgents(orgId: string): Promise<EnabledFollowupAgent[]>;
}

/** Puro: agent_ids que armam este pointer, em ordem determinística (menor uuid primeiro). */
function agentsEnablingPointer(agents: EnabledFollowupAgent[], pointerId: string): string[] {
  return agents
    .filter((a) => a.pointerIds.includes(pointerId))
    .map((a) => a.agentId)
    .sort();
}

/** Gate booleano: existe ao menos 1 agente publicado da org armando este pointer? */
export async function isPointerEnabledForAutomaticTrigger(
  db: FollowupGateDb,
  orgId: string,
  pointerId: string,
): Promise<boolean> {
  const agents = await db.loadEnabledPublishedFollowupAgents(orgId);
  return agentsEnablingPointer(agents, pointerId).length > 0;
}

/**
 * Qual agente ARMA este pointer — o agent_id a pinar no enrollment (persona +
 * exibição na fila). Determinístico quando >1 agente habilita o mesmo pointer:
 * MENOR agent_id (uuid asc). `null` = nenhum agente publicado arma (gate-out) —
 * mesma condição em que `isPointerEnabledForAutomaticTrigger` retorna false.
 */
export async function resolveAgentForAutomaticTrigger(
  db: FollowupGateDb,
  orgId: string,
  pointerId: string,
): Promise<string | null> {
  const agents = await db.loadEnabledPublishedFollowupAgents(orgId);
  return agentsEnablingPointer(agents, pointerId)[0] ?? null;
}

interface FollowupColumnShape {
  enabled?: unknown;
  flow_pointer_ids?: unknown;
}

/** Production adapter: lê `ai_agent_versions.{agent_id,followup}` via o client service-role real. */
export function createSupabaseFollowupGateDb(admin: SupabaseClient): FollowupGateDb {
  return {
    async loadEnabledPublishedFollowupAgents(orgId) {
      const { data, error } = await admin
        .from("ai_agent_versions")
        .select("agent_id, followup")
        .eq("organization_id", orgId)
        .eq("status", "published");
      if (error) throw new Error(`followup_gate_query_failed: ${error.message}`);

      // Um agente tem no máximo 1 versão publicada; ainda assim agrego por
      // agent_id (defensivo) unindo os pointers habilitados.
      const byAgent = new Map<string, Set<string>>();
      for (const row of (data ?? []) as Array<{ agent_id: string; followup: FollowupColumnShape | null }>) {
        const f = row.followup;
        if (!f || f.enabled !== true || !Array.isArray(f.flow_pointer_ids)) continue;
        const set = byAgent.get(row.agent_id) ?? new Set<string>();
        for (const id of f.flow_pointer_ids) {
          if (typeof id === "string") set.add(id);
        }
        if (set.size > 0) byAgent.set(row.agent_id, set);
      }
      return [...byAgent].map(([agentId, ids]) => ({ agentId, pointerIds: [...ids] }));
    },
  };
}
