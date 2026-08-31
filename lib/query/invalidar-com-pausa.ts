/**
 * Junta rajada de invalidação em UM refetch.
 *
 * O Realtime do inbox dispara a cada linha que o histórico do aparelho
 * grava — dezenas de conversas e mensagens em poucos segundos. Invalidar
 * na hora vira GET atrás de GET; a tela já tem dado e não mostra carga,
 * então parece travada. A pausa é o relógio do operador (doutrina do
 * tempo): observar em tempo real, refetchar no ritmo de quem olha.
 */
import type { QueryClient, QueryKey } from "@tanstack/react-query";

const DEFAULT_MS = 1_500;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function chaveDaQuery(queryKey: QueryKey): string {
  return JSON.stringify(queryKey);
}

export function invalidarComPausa(
  qc: QueryClient,
  queryKey: QueryKey,
  ms: number = DEFAULT_MS,
): void {
  const chave = chaveDaQuery(queryKey);
  const anterior = timers.get(chave);
  if (anterior) clearTimeout(anterior);
  timers.set(
    chave,
    setTimeout(() => {
      timers.delete(chave);
      void qc.invalidateQueries({ queryKey });
    }, ms),
  );
}

/** Só o teste — senão um timer de outra suíte vaza e invalida de novo. */
export function _resetarPausasParaTeste(): void {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
}
