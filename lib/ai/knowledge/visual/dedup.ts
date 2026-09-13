/**
 * Original + derivado do mesmo trecho não devem aparecer duas vezes
 * na resposta. Mantém o de maior similaridade; a citação continua original.
 */

export interface TrechoParaDedup {
  knowledge_source_id: string | null;
  content: string;
  similarity: number;
  metadata: Record<string, unknown> | null;
}

export function consolidarOriginalEDerivado<T extends TrechoParaDedup>(trechos: T[]): T[] {
  const grupos = new Map<string, T[]>();
  for (const t of trechos) {
    const meta = t.metadata ?? {};
    const page = typeof meta.page === "number" ? String(meta.page) : "x";
    const chave = `${t.knowledge_source_id ?? "s"}:${page}`;
    const lista = grupos.get(chave) ?? [];
    lista.push(t);
    grupos.set(chave, lista);
  }
  const out: T[] = [];
  for (const lista of grupos.values()) {
    if (lista.length === 1) {
      out.push(lista[0]!);
      continue;
    }
    const melhor = [...lista].sort((a, b) => b.similarity - a.similarity)[0]!;
    out.push(melhor);
  }
  return out.sort((a, b) => b.similarity - a.similarity);
}
