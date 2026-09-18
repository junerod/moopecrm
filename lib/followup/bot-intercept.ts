/**
 * Guarda do bot visual no inbound-turn: enrollment de bot ativo cala a IA.
 * Também enrolla pointers `purpose=bot` + gatilho inbound no mesmo processo
 * do turno — o drain do event_log pode chegar DEPOIS, e aí a IA falaria.
 */
import type pg from "pg";

import { triggerConfigSchema } from "./api-schemas";
import { flowGraphSchema } from "./graph-schema";
import { decidirArmacaoAutomatica, fluxoPublicadoDoGrafo } from "./fluxo-requer-ia";

export const BOT_LIVE_STATUSES = ["active", "waiting_reply", "paused_handoff"] as const;

export function enrollmentDeBotCalaIa(
  rows: ReadonlyArray<{ purpose: string | null; status: string }>,
): boolean {
  return rows.some(
    (r) => r.purpose === "bot" && (BOT_LIVE_STATUSES as readonly string[]).includes(r.status),
  );
}

export async function contatoTemBotAtivo(
  pool: pg.Pool,
  orgId: string,
  contactId: string,
): Promise<boolean> {
  const { rows } = await pool.query<{ purpose: string | null; status: string }>(
    `select p.purpose, e.status
       from followup_enrollments e
       join followup_flow_pointers p
         on p.id = e.pointer_id and p.organization_id = e.organization_id
      where e.organization_id = $1
        and e.contact_id = $2
        and e.status = any($3::text[])`,
    [orgId, contactId, [...BOT_LIVE_STATUSES]],
  );
  return enrollmentDeBotCalaIa(rows);
}

/**
 * Enrolla bots inbound publicados para este contato. Idempotente (23505).
 * Omite `next_eval_at` — o default now() do banco decide (migration 0147).
 */
export async function enrollBotsInboundSePreciso(
  pool: pg.Pool,
  orgId: string,
  contactId: string,
  conversationId: string,
): Promise<number> {
  const { rows: pointers } = await pool.query<{
    id: string;
    active_version_id: string;
    trigger_config: unknown;
  }>(
    `select id, active_version_id, trigger_config
       from followup_flow_pointers
      where organization_id = $1
        and status = 'active'
        and purpose = 'bot'
        and active_version_id is not null`,
    [orgId],
  );

  let enrolled = 0;
  for (const pointer of pointers) {
    const parsed = triggerConfigSchema.safeParse(pointer.trigger_config);
    if (!parsed.success || parsed.data.kind !== "inbound") continue;

    const { rows: versions } = await pool.query<{ graph: unknown }>(
      `select graph from followup_flow_versions
        where organization_id = $1 and id = $2`,
      [orgId, pointer.active_version_id],
    );
    const raw = versions[0]?.graph;
    if (!raw) continue;
    const graph = flowGraphSchema.safeParse(raw);
    if (!graph.success) continue;
    const fluxo = fluxoPublicadoDoGrafo(graph.data);
    if (!fluxo) continue;
    const armacao = decidirArmacaoAutomatica(fluxo.graph, null);
    if (!armacao.allowed) continue;

    try {
      const { rows: inserted } = await pool.query<{ id: string }>(
        `insert into followup_enrollments (
           organization_id, pointer_id, version_id, contact_id, conversation_id,
           current_node_id, status
         ) values ($1, $2, $3, $4, $5, $6, 'active')
         returning id`,
        [orgId, pointer.id, pointer.active_version_id, contactId, conversationId, fluxo.triggerNodeId],
      );
      const id = inserted[0]?.id;
      if (!id) continue;
      enrolled += 1;
      try {
        await pool.query(
          `insert into followup_enrollment_events (
             organization_id, enrollment_id, node_id, event_type, payload, idempotency_key
           ) values ($1, $2, $3, 'enrolled_by_inbound', $4::jsonb, $5)`,
          [
            orgId,
            id,
            fluxo.triggerNodeId,
            JSON.stringify({ conversation_id: conversationId }),
            `gatilho-inbound:${pointer.id}:${contactId}`,
          ],
        );
      } catch (evtErr) {
        if ((evtErr as { code?: string }).code !== "23505") throw evtErr;
      }
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "23505") continue;
      throw err;
    }
  }
  return enrolled;
}
