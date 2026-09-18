/**
 * Adapter fino: `aplicaGatilhoInbound` no dispatcher do event_log.
 */
import type { EventHandler, HandlerResult } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EVENTO_INBOUND,
  aplicaGatilhoInbound,
  createSupabaseGatilhoInboundDb,
} from "@/lib/followup/gatilho-inbound";

export const FOLLOWUP_GATILHO_INBOUND_HANDLER_KEY = "followup-gatilho-inbound.v1";

export const followupGatilhoInboundHandler: EventHandler = {
  key: FOLLOWUP_GATILHO_INBOUND_HANDLER_KEY,
  events: [EVENTO_INBOUND],
  async handle(row): Promise<HandlerResult> {
    try {
      const admin = createAdminClient();
      const summary = await aplicaGatilhoInbound(
        {
          db: createSupabaseGatilhoInboundDb(admin),
          clock: () => new Date(),
        },
        row,
      );
      return {
        consumer_key: FOLLOWUP_GATILHO_INBOUND_HANDLER_KEY,
        status: summary.matched ? "ok" : "skipped",
        detail:
          `armados=${summary.pointers_armados} enrolled=${summary.enrolled} ` +
          `ja_vivo=${summary.skipped_existing} gate=${summary.pointers_barrados_pelo_gate} ` +
          `sem_contato=${summary.sem_contato}`,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return { consumer_key: FOLLOWUP_GATILHO_INBOUND_HANDLER_KEY, status: "error", detail };
    }
  },
};
