import type { DocumentoExtraido } from "@/lib/ai/rag/extractors/contrato";
import { extractMarkdownText } from "@/lib/ai/rag/extractors/markdown";
import { DocumentExtractError } from "@/lib/ai/knowledge/erros-documentais";

const TETO_CHARS = 400_000;

function secoesPorHeading(texto: string): Array<{ secao?: string; texto: string }> {
  const lines = texto.split("\n");
  const secoes: Array<{ secao?: string; texto: string }> = [];
  let titulo: string | undefined;
  let corpo: string[] = [];

  const flush = () => {
    const t = corpo.join("\n").trim();
    if (!t && !titulo) return;
    secoes.push({ secao: titulo, texto: titulo ? `${titulo}\n${t}`.trim() : t });
    corpo = [];
  };

  for (const line of lines) {
    const md = /^(#{1,3})\s+(.+)$/.exec(line);
    if (md) {
      flush();
      titulo = md[2]?.trim();
      corpo = [];
      continue;
    }
    corpo.push(line);
  }
  flush();
  return secoes.filter((s) => s.texto.length > 0);
}

export function extractPlainText(buffer: Buffer): DocumentoExtraido {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "").trim();
  if (!text) {
    throw new DocumentExtractError("extract_failed", "O arquivo de texto está vazio.");
  }
  const cortado = text.slice(0, TETO_CHARS);
  const sections = secoesPorHeading(cortado);
  return {
    text: cortado,
    sections,
    metadata: {
      extractor: "texto",
      warnings: text.length > TETO_CHARS ? ["Documento cortado no limite de caracteres."] : [],
      pageCount: 0,
      charCount: cortado.length,
      wordCount: cortado.split(/\s+/).filter(Boolean).length,
      ocrUsed: false,
    },
  };
}

export function extractMarkdownDocument(buffer: Buffer): DocumentoExtraido {
  const text = extractMarkdownText(buffer);
  if (!text) {
    throw new DocumentExtractError("extract_failed", "O Markdown está vazio.");
  }
  const cortado = text.slice(0, TETO_CHARS);
  return {
    text: cortado,
    sections: secoesPorHeading(cortado),
    metadata: {
      extractor: "markdown",
      warnings: text.length > TETO_CHARS ? ["Documento cortado no limite de caracteres."] : [],
      pageCount: 0,
      charCount: cortado.length,
      wordCount: cortado.split(/\s+/).filter(Boolean).length,
      ocrUsed: false,
    },
  };
}
