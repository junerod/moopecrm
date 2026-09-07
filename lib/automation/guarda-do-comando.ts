/**
 * A mesma pergunta do before-send, para automações que ENVIA M mensagem.
 *
 * `checarGuardasDeContato` cobre bloqueio/telefone/consentimento. Isto cobre
 * o comando da conversa: humano no comando, pausada, fechada. Ações internas
 * (tag, tarefa, mover lead) NÃO passam por aqui.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { DecisaoDeEnvioConversacional } from "@/lib/inbox/comando-da-conversa";
import { decidirAPartirDosFatos, lerFatosDoComandoSupabase } from "@/lib/inbox/ler-comando";
import { logger } from "@/lib/logger";

export async function checarComandoParaEnvio(
  admin: SupabaseClient,
  ids: { organizationId: string; conversationId: string },
  agora?: Date,
): Promise<DecisaoDeEnvioConversacional> {
  const fatos = await lerFatosDoComandoSupabase(admin, ids);
  return decidirAPartirDosFatos(fatos, agora);
}

export function desfechoPuladoPorComando(
  tipo: string,
  decisao: Extract<DecisaoDeEnvioConversacional, { permitido: false }>,
): { type: string; status: "skipped"; detail: { reason: string; motivo: string } } {
  logger.info("[automation] envio pulado — comando da conversa", {
    tipo,
    codigo: decisao.codigo,
  });
  return {
    type: tipo,
    status: "skipped",
    detail: { reason: decisao.codigo, motivo: decisao.motivo },
  };
}
