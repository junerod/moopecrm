/**
 * Deep-link `/app/inbox?id=` não pode esperar a lista.

 * A lista pode estar carregando, vazia (aba Minhas sem aquela conversa)
 * ou em erro. Nesses três casos a conversa alvo ainda precisa abrir.
 * Esperar `!listQ.isLoading` deixava o fio preso em "Selecione uma conversa"
 * enquanto a lista falhava ou filtrava outro conjunto.
 */
export function precisaBuscarConversaAvulsa(
  selectedId: string | null | undefined,
  conversaNaLista: unknown,
): boolean {
  return Boolean(selectedId) && !conversaNaLista;
}
