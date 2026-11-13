/**
 * O sino precisa saber o que a pessoa JÁ abriu neste aparelho.
 * Sem tabela nova: o visto mora no localStorage, não no banco.
 */
export const CHAVE_VISTO_FUNIL = "funil-alteracoes-visto-em";

export function lidoEmMs(storage: Pick<Storage, "getItem"> | null): number | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CHAVE_VISTO_FUNIL);
    if (!raw) return null;
    const n = Date.parse(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function marcarAlteracoesVistas(
  storage: Pick<Storage, "setItem"> | null,
  agora: Date,
): void {
  if (!storage) return;
  try {
    storage.setItem(CHAVE_VISTO_FUNIL, agora.toISOString());
  } catch {
    /* cota */
  }
}

export function contarNaoVistas(
  itens: Array<{ em: string }>,
  vistoEmMs: number | null,
): number {
  if (vistoEmMs == null) return itens.length;
  return itens.filter((i) => Date.parse(i.em) > vistoEmMs).length;
}
