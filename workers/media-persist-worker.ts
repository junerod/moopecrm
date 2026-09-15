/**
 * Consome `media.persist_requested`. A lógica mora em
 * `lib/messaging/media/persistir.ts` — ingestão e GET da inbox usam a mesma.
 */
import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import {
  MEDIA_PERSIST_CONSUMER_KEY,
  persistirMidiaDaMensagem,
} from "@/lib/messaging/media/persistir";

export { MEDIA_PERSIST_CONSUMER_KEY };

export async function persistMessageMedia(row: EventRow): Promise<HandlerResult> {
  const messageId = (row.payload.message_id as string | undefined) ?? row.entity_id;
  if (!messageId) {
    return { consumer_key: MEDIA_PERSIST_CONSUMER_KEY, status: "skipped", detail: "no message_id" };
  }
  return persistirMidiaDaMensagem({
    organizationId: row.organization_id,
    messageId,
    attempts: row.attempts,
  });
}
