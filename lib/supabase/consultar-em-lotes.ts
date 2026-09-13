/**
 * PostgREST monta `.in(col, ids)` na QUERY STRING do GET.
 * Cada UUID ~37 chars; 80+ ids estouram "URI too long" (medido no board).
 *
 * A doutrina do Bloco 2: nunca uma cláusula com a lista inteira de cards.
 * Ou carrega por organização + casa em memória, ou parte em lotes curtos.
 */

export const TETO_IDS_POR_LOTE = 40;

/** Piso conservador: proxies e o PostgREST recusam GET perto de 8 KB. */
export const TETO_URI_GET = 2_048;

export function partirIdsEmLotes<T extends string>(
  ids: readonly T[],
  teto = TETO_IDS_POR_LOTE,
): T[][] {
  const unicos = [...new Set(ids)];
  const lotes: T[][] = [];
  for (let i = 0; i < unicos.length; i += teto) {
    lotes.push(unicos.slice(i, i + teto));
  }
  return lotes;
}

/** Tamanho do fragmento `in.(id,id,…)` que o PostgREST coloca na URL. */
export function tamanhoDaClausulaIn(ids: readonly string[]): number {
  return `in.(${ids.join(",")})`.length;
}

export async function consultarInEmLotes<T>(
  ids: readonly string[],
  consultar: (
    lote: string[],
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[]; error: string | null }> {
  if (ids.length === 0) return { data: [], error: null };
  const lotes = partirIdsEmLotes(ids);
  const resultados = await Promise.all(lotes.map((lote) => consultar(lote)));
  const all: T[] = [];
  for (const r of resultados) {
    if (r.error) return { data: all, error: r.error.message };
    if (r.data) all.push(...r.data);
  }
  return { data: all, error: null };
}
