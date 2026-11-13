/**
 * Rascunho da caixa, por conversa, neste aparelho.
 *
 * Sair da conversa não pode apagar o que a pessoa estava escrevendo.
 * Não vai para o banco: é o mesmo computador, a mesma sessão de trabalho.
 */

export const PREFIXO_RASCUNHO = "inbox-rascunho:";

export function chaveDoRascunho(conversationId: string): string {
  return `${PREFIXO_RASCUNHO}${conversationId}`;
}

type Leitor = Pick<Storage, "getItem">;
type Gravador = Pick<Storage, "setItem" | "removeItem">;

export function lerRascunho(storage: Leitor | null, conversationId: string): string {
  if (!storage || !conversationId) return "";
  try {
    return storage.getItem(chaveDoRascunho(conversationId)) ?? "";
  } catch {
    return "";
  }
}

export function gravarRascunho(
  storage: Gravador | null,
  conversationId: string,
  texto: string,
): void {
  if (!storage || !conversationId) return;
  try {
    if (!texto) {
      storage.removeItem(chaveDoRascunho(conversationId));
      return;
    }
    storage.setItem(chaveDoRascunho(conversationId), texto);
  } catch {
    /* cota cheia — o envio ainda funciona */
  }
}
