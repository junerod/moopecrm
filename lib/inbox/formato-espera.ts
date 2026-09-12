/** Espera da fila — um formatador só, sobre os segundos de `getQueueStatus`. */
export function formatarEsperaEmSegundos(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return "1 min";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  if (resto === 0) return h === 1 ? "1 h" : `${h} h`;
  return `${h} h ${resto} min`;
}

export function resumoDaFila(entrada: {
  queue_size: number;
  oldest_wait_seconds: number;
}): { titulo: string; detalhe: string } {
  const n = Math.max(0, entrada.queue_size);
  if (n === 0) return { titulo: "Fila", detalhe: "vazia" };
  const aguardando = n === 1 ? "1 aguardando" : `${n} aguardando`;
  return {
    titulo: "Fila",
    detalhe: `${aguardando} · mais antiga: ${formatarEsperaEmSegundos(entrada.oldest_wait_seconds)}`,
  };
}
