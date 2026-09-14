/**
 * Campanha no número com risco de banimento só fala com quem JÁ tem fio
 * naquele número. Não abre conversa fria. Número reconectado (STOPPED +
 * WORKING do mesmo telefone) conta como o mesmo fio.
 */
import {
  escolherSessaoVivaParaEnvio,
  sessaoEstaProntaParaEnvio,
  sessoesSupersedidasDoNumero,
  type SessaoParaEnvio,
} from "@/lib/channels/sessao-viva-para-envio";

export interface ConversaParaFio {
  id: string;
  channel_session_id: string;
}

export function decidirFioDaCampanha(input: {
  sessaoPedida: string | null;
  sessoes: SessaoParaEnvio[];
  conversas: ConversaParaFio[];
}): { conversationId: string; sessionId: string } | null {
  const vivas = input.sessoes.filter((s) => sessaoEstaProntaParaEnvio(s));
  if (vivas.length === 0) return null;

  const pedida = input.sessaoPedida
    ? input.sessoes.find((s) => s.id === input.sessaoPedida)
    : null;
  const alvo =
    escolherSessaoVivaParaEnvio(pedida ?? null, input.sessoes) ??
    vivas[0] ??
    null;
  if (!alvo) return null;

  const idsDoNumero = new Set([alvo.id, ...sessoesSupersedidasDoNumero(alvo, input.sessoes)]);
  const fio = input.conversas.find((c) => idsDoNumero.has(c.channel_session_id));
  if (!fio) return null;
  return { conversationId: fio.id, sessionId: alvo.id };
}
