import type { InboxTab } from "@/components/inbox/InboxFilters";

/**
 * Aba que a Inbox abre quando a URL não traz `?filter=`.
 *
 * Fila (`unassigned`) era o default de todo papel. Na operação comercial isso
 * mostra primeiro conversas sem dono — frequentemente o automático e threads
 * vazias — e esconde o que o atendente já assumiu (aba Minhas).
 *
 * Default novo: **Minhas** (`mine`), para todos os papéis.
 * Fila continua filtro visível, com a mesma query de sempre.
 * `?filter=` explícito (incluindo `unassigned`) é honrado.
 *
 * Fallback: quem precisa da fila técnica clica em Fila. Nenhum escopo RLS muda.
 */
export const ABA_PADRAO_DA_INBOX: InboxTab = "mine";

export function parseAbaDaInbox(v: string | null, validas: readonly InboxTab[]): InboxTab {
  return v && validas.includes(v as InboxTab) ? (v as InboxTab) : ABA_PADRAO_DA_INBOX;
}
