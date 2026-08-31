import type { EventHandler } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  entregarEventoAoParceiro,
  MOOPE_OUTBOUND_HANDLER_KEY,
} from "@/lib/moope/eventos-outbound";
import { MOOPE_OUTBOUND_TYPES } from "@/lib/moope/tipos";

export const moopeOutboundHandler: EventHandler = {
  key: MOOPE_OUTBOUND_HANDLER_KEY,
  events: [...MOOPE_OUTBOUND_TYPES],
  async handle(row) {
    return entregarEventoAoParceiro(createAdminClient(), row);
  },
};
