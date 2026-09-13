/**
 * Heurística conservadora: Vision só quando a página parece carregar
 * informação visual que o texto não cobre. Custo controlado.
 */

export const TETO_PAGINAS_VISION = 6;
export const CHARS_TEXTO_SUFICIENTE = 400;
export const CHARS_TEXTO_POBRE = 80;

export interface PaginaParaHeuristica {
  pagina: number;
  texto: string;
  temImagem?: boolean;
}

export interface DecisaoVisual {
  pagina: number;
  precisaVision: boolean;
  motivo: "texto_suficiente" | "pouco_texto" | "imagem_grande" | "screenshot" | "tabela_visual";
}

const SINAIS_TELA =
  /\b(clique|clicar|menu|bot[aã]o|aba|tela|screenshot|painel|card|campo|sidebar|kanban)\b/i;
const SINAIS_TABELA = /\b(tabela|diária|caucao|caução|preço|modulo|módulo)\b/i;

export function decidirVisionNaPagina(p: PaginaParaHeuristica): DecisaoVisual {
  const texto = (p.texto ?? "").trim();
  const chars = texto.length;

  if (chars >= CHARS_TEXTO_SUFICIENTE && !p.temImagem) {
    return { pagina: p.pagina, precisaVision: false, motivo: "texto_suficiente" };
  }
  if (p.temImagem && chars < CHARS_TEXTO_SUFICIENTE) {
    return { pagina: p.pagina, precisaVision: true, motivo: "imagem_grande" };
  }
  if (chars < CHARS_TEXTO_POBRE) {
    return { pagina: p.pagina, precisaVision: true, motivo: "pouco_texto" };
  }
  if (p.temImagem && SINAIS_TELA.test(texto)) {
    return { pagina: p.pagina, precisaVision: true, motivo: "screenshot" };
  }
  if (chars < 180 && SINAIS_TABELA.test(texto)) {
    return { pagina: p.pagina, precisaVision: true, motivo: "tabela_visual" };
  }
  if (chars >= CHARS_TEXTO_SUFICIENTE) {
    return { pagina: p.pagina, precisaVision: false, motivo: "texto_suficiente" };
  }
  return { pagina: p.pagina, precisaVision: true, motivo: "pouco_texto" };
}

export function paginasQuePedemVision(
  paginas: PaginaParaHeuristica[],
  teto = TETO_PAGINAS_VISION,
): DecisaoVisual[] {
  return paginas
    .map(decidirVisionNaPagina)
    .filter((d) => d.precisaVision)
    .slice(0, teto);
}
