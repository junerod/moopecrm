/**
 * Pipeline PDF de produção: pdfjs → classificação → fallback de fluxo → OCR.
 *
 * `extractPdfDocument` continua a engine única de layout (issue #238).
 * Esta função NÃO troca isso por pdf-parse. O fallback é outro algoritmo.
 */

import type { DocumentoExtraido, PaginaOuSecao } from "@/lib/ai/rag/extractors/contrato";
import {
  bufferParecePdf,
  medirQualidadePdf,
  pdfPareceCriptografado,
} from "@/lib/ai/rag/extractors/pdf-classificar";
import { extrairPdfPorFluxo } from "@/lib/ai/rag/extractors/pdf-fluxo";
import { extractPdfDocument, PdfExtractError } from "@/lib/ai/rag/extractors/pdf";
import { DocumentExtractError } from "@/lib/ai/knowledge/erros-documentais";
import { ocrConfigurado, resolverOcr } from "@/lib/ai/rag/ocr/resolver";
import { logger } from "@/lib/logger";

const MAX_PAGINAS = 80;

function erroDeSenha(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string; code?: number };
  if (e.name === "PasswordException") return true;
  if (typeof e.message === "string" && /password|encrypted|criptograf/i.test(e.message)) {
    return true;
  }
  return false;
}

async function tentarPdfjs(buffer: Buffer): Promise<{
  texto: string;
  paginas: PaginaOuSecao[];
  pageCount: number;
} | "encrypted" | "empty" | "fail"> {
  try {
    const doc = await extractPdfDocument(buffer);
    const pageCount = Math.min(doc.pageCount, MAX_PAGINAS);
    const paginas = doc.paginas
      .filter((p) => p.pagina <= MAX_PAGINAS)
      .map((p) => ({ pagina: p.pagina, texto: p.texto }));
    return { texto: doc.texto, paginas, pageCount: doc.pageCount };
  } catch (err) {
    if (erroDeSenha(err) || (err instanceof PdfExtractError && erroDeSenha(err.cause))) {
      return "encrypted";
    }
    if (err instanceof PdfExtractError && /no text|image-only/i.test(err.message)) {
      return "empty";
    }
    return "fail";
  }
}

export async function extractPdfRobusto(buffer: Buffer): Promise<DocumentoExtraido> {
  const t0 = Date.now();
  if (!bufferParecePdf(buffer)) {
    throw new DocumentExtractError("pdf_corrupt");
  }
  if (pdfPareceCriptografado(buffer)) {
    throw new DocumentExtractError("pdf_encrypted");
  }

  const primeiro = await tentarPdfjs(buffer);
  if (primeiro === "encrypted") {
    throw new DocumentExtractError("pdf_encrypted");
  }

  let texto = "";
  let paginas: PaginaOuSecao[] = [];
  let pageCount = 0;
  let extractor = "pdfjs-dist";
  const warnings: string[] = [];

  if (primeiro !== "empty" && primeiro !== "fail") {
    texto = primeiro.texto;
    paginas = primeiro.paginas;
    pageCount = primeiro.pageCount;
    if (pageCount > MAX_PAGINAS) {
      warnings.push(`Documento com ${pageCount} páginas; extraímos as primeiras ${MAX_PAGINAS}.`);
      pageCount = MAX_PAGINAS;
    }
  }

  let qualidade = medirQualidadePdf(
    pageCount || paginas.length,
    paginas.map((p) => p.texto),
  );

  if (primeiro === "fail" || qualidade.classification !== "TEXTUAL") {
    const fluxo = extrairPdfPorFluxo(buffer);
    const qFluxo = medirQualidadePdf(
      Math.max(fluxo.paginas.length, pageCount, 1),
      fluxo.paginas.map((p) => p.texto),
    );
    if (qFluxo.chars > qualidade.chars) {
      texto = fluxo.texto;
      paginas = fluxo.paginas;
      pageCount = Math.max(pageCount, fluxo.paginas.length);
      extractor = "pdf-fluxo";
      qualidade = qFluxo;
      warnings.push("Extração textual do pdfjs foi insuficiente; usamos o parser de operadores.");
    } else if (primeiro === "fail" && qFluxo.chars === 0) {
      throw new DocumentExtractError("pdf_corrupt");
    }
  }

  let ocrUsed = false;
  if (
    (qualidade.classification === "IMAGE_ONLY" || qualidade.classification === "LOW_TEXT") &&
    ocrConfigurado()
  ) {
    try {
      const { renderizarPaginasPdf } = await import("@/lib/ai/rag/ocr/render-pdf");
      const imagens = await renderizarPaginasPdf(buffer, pageCount || 1);
      const ocr = await resolverOcr();
      const r = await ocr.reconhecer({ imagens });
      if (r.paginas.length > 0) {
        paginas = r.paginas.map((p) => ({ pagina: p.pagina, texto: p.texto }));
        texto = paginas.map((p) => p.texto).join("\n\n");
        extractor = `${extractor}+ocr:${r.provider}`;
        ocrUsed = true;
        qualidade = medirQualidadePdf(pageCount || r.paginas.length, paginas.map((p) => p.texto));
        warnings.push("Páginas sem texto pesquisável passaram por OCR.");
      }
    } catch (err) {
      logger.warn("knowledge.pdf.ocr_failed", {
        erro: err instanceof Error ? err.message.slice(0, 200) : "ocr_failed",
      });
      warnings.push("OCR falhou; o documento continua sem texto pesquisável.");
    }
  }

  if (qualidade.classification === "IMAGE_ONLY" || (qualidade.chars === 0 && !ocrUsed)) {
    return {
      text: "",
      pages: [],
      metadata: {
        extractor,
        classification: "IMAGE_ONLY",
        warnings,
        pageCount: pageCount || 1,
        charCount: 0,
        wordCount: 0,
        emptyPageRatio: 1,
        ocrUsed,
        errorCode: "pdf_needs_ocr",
      },
    };
  }

  if (qualidade.classification === "LOW_TEXT" && qualidade.chars < 40 && !ocrUsed) {
    return {
      text: texto,
      pages: paginas,
      metadata: {
        extractor,
        classification: "LOW_TEXT",
        warnings,
        pageCount: qualidade.pageCount,
        charCount: qualidade.chars,
        wordCount: qualidade.words,
        emptyPageRatio: qualidade.emptyPageRatio,
        ocrUsed,
        errorCode: "pdf_needs_ocr",
      },
    };
  }

  logger.info("knowledge.pdf.extract", {
    extractor,
    classification: qualidade.classification,
    pages: qualidade.pageCount,
    chars: qualidade.chars,
    ocr_used: ocrUsed,
    extract_ms: Date.now() - t0,
  });

  return {
    text: texto,
    pages: paginas,
    metadata: {
      extractor,
      classification: qualidade.classification,
      warnings,
      pageCount: qualidade.pageCount,
      charCount: qualidade.chars,
      wordCount: qualidade.words,
      emptyPageRatio: qualidade.emptyPageRatio,
      ocrUsed,
    },
  };
}
