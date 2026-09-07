/**
 * Envio humano pelo Inbox = assumir o atendimento.
 *
 * A janela de 5 minutos que `sendMessageHandler` gravava era um silêncio que se
 * desfazia sozinho: o cliente falava de novo e a IA voltava. Isto grava o mesmo
 * silêncio DURÁVEL do botão Assumir (`infinity`) e, se a conversa não tiver dono,
 * reclama via `fn_conversation_assign`. Não toca `force_human` — aquela trava é
 * do contato inteiro.
 *
 * A IA só volta com Devolver para automação (`devolverAtendimentoAoAgente`).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { invalidarJobsConversacionaisSupabase } from "@/lib/ai/execucao/invalidar-jobs";
import type { Actor } from "@/lib/api/handlers/types";
import { registrarTrocaDeComando } from "@/lib/inbox/atividade-de-comando";
import { logger } from "@/lib/logger";

/** O mesmo literal do handoff e do pause-ai. */
export const SILENCIO_DURAVEL = "infinity";

export async function assumirPeloEnvioHumano(entrada: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  contactId: string;
  assignedToUserId: string | null;
  actor: Actor;
}): Promise<{ assumiu: boolean }> {
  let assumiu = false;

  if (!entrada.assignedToUserId && entrada.actor.type === "user") {
    const { data, error } = await entrada.supabase.rpc("fn_conversation_assign", {
      p_organization_id: entrada.organizationId,
      p_conversation_id: entrada.conversationId,
      p_to_user_id: entrada.actor.id,
      p_reason: "claim",
      p_expected_assignee: null,
      p_enforce_expected: true,
    });
    if (error) {
      // O envio do atendente não pode falhar porque o claim correu. O silêncio
      // durável abaixo ainda cala o automático nesta conversa.
      logger.warn("[inbox.envio] claim ao enviar não gravou — segue com o silêncio", {
        conversation_id: entrada.conversationId,
        erro: error.message.slice(0, 160),
      });
    } else if (!Array.isArray(data) || data.length > 0) {
      // Sem array (dublê de teste) ou com linha: o claim pegou. Array vazio é
      // a corrida — outro atendente assumiu no mesmo instante.
      assumiu = true;
    }
  }

  // Um `eq` só, o mesmo padrão do update pós-envio do handler: os dublês de
  // teste encadeiam um único filtro. A org já entrou no RPC do claim.
  const { error: silErr } = await entrada.supabase
    .from("conversations")
    .update({
      bot_silenced_until: SILENCIO_DURAVEL,
      last_handoff_reason: assumiu
        ? "Assumiu a conversa ao enviar uma mensagem"
        : "Pausou o automático ao enviar uma mensagem",
    })
    .eq("id", entrada.conversationId);
  if (silErr) {
    logger.warn("[inbox.envio] silêncio durável não gravou", {
      conversation_id: entrada.conversationId,
      erro: silErr.message.slice(0, 160),
    });
  }

  await invalidarJobsConversacionaisSupabase({
    organizationId: entrada.organizationId,
    contactId: entrada.contactId,
    conversationId: entrada.conversationId,
  });

  await registrarTrocaDeComando({
    supabase: entrada.supabase,
    organizationId: entrada.organizationId,
    conversationId: entrada.conversationId,
    contactId: entrada.contactId,
    tipo: assumiu ? "conversation_claimed" : "conversation_ai_paused",
    actor: entrada.actor,
    motivo: assumiu
      ? "Assumiu a conversa ao enviar uma mensagem"
      : "Pausou o automático ao enviar uma mensagem",
    payload: { origem: "inbox.send", assumiu_ao_enviar: assumiu },
  });

  return { assumiu };
}
