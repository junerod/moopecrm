/**
 * O sinal de que a tela AINDA ESTÁ LENDO — refetch com dado na tela.
 *
 * Skeleton só cobre a primeira carga (`isLoading`). O inbox e Contatos
 * refetcham com a lista já pintada (`isFetching`); sem isto o operador
 * acha que travou, porque o GET está no ar e a tela não se mexe.
 */
export function IndicadorDeCarga({
  ativo,
  rotulo = "Atualizando…",
}: {
  ativo: boolean;
  rotulo?: string;
}) {
  if (!ativo) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex items-center gap-2 border-b border-border bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground"
    >
      <span
        className="inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
        aria-hidden
      />
      {rotulo}
    </div>
  );
}
