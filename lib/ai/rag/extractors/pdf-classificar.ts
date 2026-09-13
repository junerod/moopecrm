import type { ClassificacaoPdf } from "@/lib/ai/rag/extractors/contrato";

export interface QualidadePdf {
  chars: number;
  words: number;
  pageCount: number;
  emptyPages: number;
  charsPerPage: number;
  emptyPageRatio: number;
  classification: ClassificacaoPdf;
}

/**
 * Um PDF de 10 páginas com 30 caracteres não é sucesso — é imagem com lixo.
 * O teto é deliberadamente baixo: PDF comercial curto (1 página, 200 chars)
 * ainda passa; escaneado quase sempre cai em IMAGE_ONLY / LOW_TEXT.
 */
export function medirQualidadePdf(
  pageCount: number,
  textosPorPagina: string[],
): QualidadePdf {
  const paginas = Math.max(pageCount, 0);
  const textos = textosPorPagina.map((t) => t.trim());
  const chars = textos.reduce((acc, t) => acc + t.length, 0);
  const words = textos
    .join(" ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
  const emptyPages = Math.max(0, paginas - textos.filter((t) => t.length > 0).length);
  const charsPerPage = chars / Math.max(paginas, 1);
  const emptyPageRatio = emptyPages / Math.max(paginas, 1);

  let classification: ClassificacaoPdf = "TEXTUAL";
  if (chars === 0) classification = "IMAGE_ONLY";
  else if (paginas >= 2 && chars < 40) classification = "IMAGE_ONLY";
  else if (chars < 20) classification = "IMAGE_ONLY";
  else if (charsPerPage < 40 && emptyPageRatio > 0.5) classification = "LOW_TEXT";
  else if (chars < 80 && paginas >= 3) classification = "LOW_TEXT";

  return {
    chars,
    words,
    pageCount: paginas,
    emptyPages,
    charsPerPage,
    emptyPageRatio,
    classification,
  };
}

export function pdfPareceCriptografado(buffer: Buffer): boolean {
  const cabeca = buffer.subarray(0, 32_768).toString("latin1");
  return /\/Encrypt[\s\/<]/.test(cabeca);
}

export function bufferParecePdf(buffer: Buffer): boolean {
  const inicio = buffer.subarray(0, 8).toString("latin1");
  return inicio.startsWith("%PDF-");
}
