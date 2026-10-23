/** Largura da coluna (`w-80` = 320px) + gap (`gap-3` = 12px). */
export const LARGURA_PASSO_COLUNA = 332;

/**
 * Qual chip do trilho está sob o ponteiro (mouse ou dedo) durante o arrasto.
 * Soltar o card num chip move para aquela etapa — é o único jeito de alcançar
 * etapa fora da tela, porque o dnd não rola o quadro na horizontal (coluna rola
 * dentro de quadro que rola). Decide pelo PONTEIRO, não pela caixa do card: o
 * card cobre vários chips e colunas ao mesmo tempo, e o dnd escolhia o errado.
 */
export function chipNoPonto(
  chips: ReadonlyArray<{ id: string; left: number; right: number; top: number; bottom: number }>,
  x: number,
  y: number,
  folga = 6,
): string | null {
  for (const c of chips) {
    if (x >= c.left - folga && x <= c.right + folga && y >= c.top - folga && y <= c.bottom + folga) {
      return c.id;
    }
  }
  return null;
}

/**
 * Coluna sob a borda esquerda do quadro. Se o próximo início está logo
 * à frente (snap / meio-pixel / 12px), já estamos nela — senão a seta
 * “andava” esses pixels e parecia morta até o segundo clique.
 */
export function indiceDaColuna(
  inicios: readonly number[],
  scrollLeft: number,
  folga = 16,
  quaseLa = 48,
): number {
  if (inicios.length === 0) return 0;
  let idx = 0;
  for (let i = 0; i < inicios.length; i++) {
    if (inicios[i]! <= scrollLeft + folga) idx = i;
    else break;
  }
  const prox = inicios[idx + 1];
  if (prox !== undefined && prox - scrollLeft < quaseLa) idx += 1;
  return idx;
}

/**
 * Para onde a seta leva: o início da coluna vizinha, nunca um passo fixo
 * nem os 12px até o snap. `inicios` em ordem crescente, já em scrollLeft.
 */
export function alvoDaSeta(
  inicios: readonly number[],
  scrollLeft: number,
  maxScroll: number,
  dir: -1 | 1,
  folga = 16,
): number {
  if (inicios.length === 0) return dir === 1 ? Math.max(0, maxScroll) : 0;
  const idx = indiceDaColuna(inicios, scrollLeft, folga);
  if (dir === -1) {
    const inicioAtual = inicios[idx];
    if (inicioAtual !== undefined && scrollLeft - inicioAtual > 48) {
      return Math.max(0, inicioAtual);
    }
  }
  const vizinha = inicios[idx + dir];
  if (vizinha === undefined) return dir === 1 ? Math.max(0, maxScroll) : 0;
  return Math.min(maxScroll, Math.max(0, vizinha));
}

/**
 * Roda do mouse vira rolagem lateral quando o ponteiro NÃO está numa lista que
 * rola na vertical. Quem tem mouse sem roda lateral (o comum no Windows)
 * passava a etapa vazia sem conseguir ir para o lado.
 */
export function rodaViraLateral(input: {
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  lista: { scrollHeight: number; clientHeight: number } | null;
}): boolean {
  if (input.ctrlKey) return false;
  if (input.deltaY === 0) return false;
  if (Math.abs(input.deltaX) >= Math.abs(input.deltaY)) return false;
  if (input.lista && input.lista.scrollHeight > input.lista.clientHeight + 1) return false;
  return true;
}
