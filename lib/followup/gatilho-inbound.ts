/**
 * Gatilho inbound (`trigger_config.kind='inbound'`, `purpose='bot'`).
 * Primeira mensagem / conversa aberta enrolla o quadro do bot.
 *
 * O insert omite `next_eval_at` — o default now() do banco decide (0147).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { EventRow } from "@/lib/event-log/dispatcher";
import { flowGraphSchema } from "./graph-schema";
import { triggerConfigSchema } from "./api-schemas";
import {
  decidirArmacaoAutomatica,
  fluxoPublicadoDoGrafo,
  type FluxoPublicado,
} from "./fluxo-requer-ia";

export const EVENTO_INBOUND = "message.received";

export const IDADE_MAXIMA_MS = 60 * 60 * 1000;

export interface PointerDeInbound {
  id: string;
  organization_id: string;
  active_version_id: string;
}

export interface GatilhoInboundDb {
  carregaPointersDeInbound(orgId: string): Promise<PointerDeInbound[]>;
  carregaContatoDaConversa(orgId: string, conversationId: string): Promise<string | null>;
  carregaFluxoPublicado(orgId: string, versionId: string): Promise<FluxoPublicado | null>;
  insereEnrollment(input: {
    organization_id: string;
    pointer_id: string;
    version_id: string;
    contact_id: string;
    conversation_id: string;
    current_node_id: string;
    agent_id: string | null;
  }): Promise<{ inserted: boolean; id: string | null }>;
  insereEventoDoEnrollment(evento: {
    organization_id: string;
    enrollment_id: string;
    node_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    idempotency_key: string;
  }): Promise<void>;
}

export interface GatilhoInboundSummary {
  matched: boolean;
  pointers_armados: number;
  enrolled: number;
  skipped_existing: number;
  vencidos: number;
  sem_contato: number;
  pointers_barrados_pelo_gate: number;
}

function vazio(): GatilhoInboundSummary {
  return {
    matched: false,
    pointers_armados: 0,
    enrolled: 0,
    skipped_existing: 0,
    vencidos: 0,
    sem_contato: 0,
    pointers_barrados_pelo_gate: 0,
  };
}

function textoOuNulo(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function passouDoTeto(row: EventRow, agora: Date): boolean {
  if (!row.created_at) return false;
  const criado = Date.parse(row.created_at);
  if (Number.isNaN(criado)) return false;
  return agora.getTime() - criado > IDADE_MAXIMA_MS;
}

export interface GatilhoInboundDeps {
  db: GatilhoInboundDb;
  clock: () => Date;
}

export async function aplicaGatilhoInbound(
  deps: GatilhoInboundDeps,
  row: EventRow,
): Promise<GatilhoInboundSummary> {
  const summary = vazio();
  if (row.event_type !== EVENTO_INBOUND) return summary;

  const conversationId = textoOuNulo(row.payload.conversation_id);
  if (!conversationId) return summary;
  summary.matched = true;

  const armados = await deps.db.carregaPointersDeInbound(row.organization_id);
  summary.pointers_armados = armados.length;
  if (armados.length === 0) return summary;

  if (passouDoTeto(row, deps.clock())) {
    summary.vencidos = armados.length;
    return summary;
  }

  const contatoId =
    textoOuNulo(row.payload.contact_id) ??
    (await deps.db.carregaContatoDaConversa(row.organization_id, conversationId));
  if (!contatoId) {
    summary.sem_contato = armados.length;
    return summary;
  }

  for (const pointer of armados) {
    const fluxo = await deps.db.carregaFluxoPublicado(row.organization_id, pointer.active_version_id);
    if (!fluxo) continue;
    const armacao = decidirArmacaoAutomatica(fluxo.graph, null);
    if (!armacao.allowed) {
      summary.pointers_barrados_pelo_gate++;
      continue;
    }

    const { inserted, id } = await deps.db.insereEnrollment({
      organization_id: row.organization_id,
      pointer_id: pointer.id,
      version_id: pointer.active_version_id,
      contact_id: contatoId,
      conversation_id: conversationId,
      current_node_id: fluxo.triggerNodeId,
      agent_id: armacao.agentId,
    });
    if (!inserted) {
      summary.skipped_existing++;
      continue;
    }
    summary.enrolled++;
    if (id) {
      await deps.db.insereEventoDoEnrollment({
        organization_id: row.organization_id,
        enrollment_id: id,
        node_id: fluxo.triggerNodeId,
        event_type: "enrolled_by_inbound",
        payload: { conversation_id: conversationId, event_log_id: row.id },
        idempotency_key: `gatilho-inbound:${row.id}:${pointer.id}`,
      });
    }
  }

  return summary;
}

export function createSupabaseGatilhoInboundDb(admin: SupabaseClient): GatilhoInboundDb {
  return {
    async carregaPointersDeInbound(orgId) {
      const { data, error } = await admin
        .from("followup_flow_pointers")
        .select("id, organization_id, active_version_id, trigger_config, purpose")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .eq("purpose", "bot")
        .not("active_version_id", "is", null);
      if (error) throw new Error(error.message);

      const pointers: PointerDeInbound[] = [];
      for (const row of (data ?? []) as Array<{
        id: string;
        organization_id: string;
        active_version_id: string | null;
        trigger_config: unknown;
      }>) {
        if (!row.active_version_id) continue;
        const parsed = triggerConfigSchema.safeParse(row.trigger_config);
        if (!parsed.success || parsed.data.kind !== "inbound") continue;
        pointers.push({
          id: row.id,
          organization_id: row.organization_id,
          active_version_id: row.active_version_id,
        });
      }
      return pointers;
    },

    async carregaContatoDaConversa(orgId, conversationId) {
      const { data, error } = await admin
        .from("conversations")
        .select("contact_id")
        .eq("id", conversationId)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.contact_id ?? null;
    },

    async carregaFluxoPublicado(orgId, versionId) {
      const { data, error } = await admin
        .from("followup_flow_versions")
        .select("graph")
        .eq("organization_id", orgId)
        .eq("id", versionId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return fluxoPublicadoDoGrafo(flowGraphSchema.parse(data.graph));
    },

    async insereEnrollment(input) {
      const { data, error } = await admin
        .from("followup_enrollments")
        .insert(input)
        .select("id")
        .maybeSingle();
      if (error) {
        if (error.code === "23505") return { inserted: false, id: null };
        throw new Error(error.message);
      }
      return { inserted: true, id: (data as { id: string } | null)?.id ?? null };
    },

    async insereEventoDoEnrollment(evento) {
      const { error } = await admin.from("followup_enrollment_events").insert(evento);
      if (error && error.code !== "23505") throw new Error(error.message);
    },
  };
}
