/**
 * Emite evento no event_log para o worker outbound do MOOPE consumir.
 *
 * Trigger NUNCA faz HTTP. O drain do event_log leva até o webhook do parceiro.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import type { MoopeOutboundType } from "@/lib/moope/tipos";

export async function emitirParaParceiro(
  admin: SupabaseClient,
  orgId: string,
  eventType: MoopeOutboundType,
  entityKind: string,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.rpc("emit_event" as never, {
    p_event_type: eventType,
    p_entity_kind: entityKind,
    p_entity_id: entityId,
    p_payload: payload,
    p_metadata: { moope: true },
    p_organization_id: orgId,
  } as never);
  if (error) {
    logger.warn("[moope.emitir] emit_event falhou", { eventType, orgId, detalhe: error.message });
  }
}

/** Conversa recém-criada (menos de 15s) vira conversation.opened uma vez. */
export async function avisarConversaAbertaSeNova(
  admin: SupabaseClient,
  orgId: string,
  conversationId: string,
  contactId: string | null,
): Promise<void> {
  const { data } = await admin
    .from("conversations")
    .select("id, created_at")
    .eq("id", conversationId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!data) return;
  const criada = new Date(String((data as { created_at: string }).created_at)).getTime();
  if (Number.isNaN(criada) || Date.now() - criada > 15_000) return;
  await emitirParaParceiro(admin, orgId, "conversation.opened", "conversation", conversationId, {
    contact_id: contactId,
  });
}
