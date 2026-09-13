/**
 * Extração DOCX via mammoth — texto, headings e tabelas em forma textual.
 * Não devolve HTML para o RAG.
 */

import type { DocumentoExtraido, PaginaOuSecao } from "@/lib/ai/rag/extractors/contrato";
import { DocumentExtractError } from "@/lib/ai/knowledge/erros-documentais";

const TETO_CHARS = 400_000;

function htmlParaSecoes(html: string): PaginaOuSecao[] {
  const secoes: PaginaOuSecao[] = [];
  const bloco = html
    .replace(/<\/(p|h[1-3]|tr|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  const linhas = bloco.split("\n");
  let titulo: string | undefined;
  let corpo: string[] = [];
  const flush = () => {
    const texto = (titulo ? `${titulo}\n${corpo.join("\n")}` : corpo.join("\n")).trim();
    if (!texto) return;
    secoes.push({ secao: titulo, texto });
    corpo = [];
  };

  for (const linha of linhas) {
    const t = linha.trim();
    if (!t) continue;
    // mammoth não marca heading no texto plano; headings curtos isolados viram seção
    if (t.length <= 80 && corpo.length > 0 && !t.includes("|") && /^[A-ZÁÉÍÓÚÃÕÂÊÔÇ0-9]/.test(t)) {
      flush();
      titulo = t;
      continue;
    }
    corpo.push(t);
  }
  flush();
  return secoes;
}

function headingsDoHtml(html: string): PaginaOuSecao[] {
  const secoes: PaginaOuSecao[] = [];
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const partes = html.split(/<h[1-3][^>]*>/i);
  if (!/<h[1-3]/i.test(html)) return [];

  let resto = html;
  let m: RegExpExecArray | null;
  const matches: Array<{ titulo: string; index: number; len: number }> = [];
  while ((m = re.exec(html))) {
    matches.push({
      titulo: (m[2] ?? "").replace(/<[^>]+>/g, "").trim(),
      index: m.index,
      len: m[0].length,
    });
  }
  if (matches.length === 0) return [];

  for (let i = 0; i < matches.length; i++) {
    const atual = matches[i]!;
    const proximo = matches[i + 1];
    const inicio = atual.index + atual.len;
    const fim = proximo ? proximo.index : html.length;
    const pedaco = html
      .slice(inicio, fim)
      .replace(/<\/(p|tr|table)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/td>/gi, " | ")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .trim();
    const texto = [atual.titulo, pedaco].filter(Boolean).join("\n").trim();
    if (texto) secoes.push({ secao: atual.titulo || undefined, texto });
  }
  void resto;
  void partes;
  return secoes;
}

export async function extractDocx(buffer: Buffer): Promise<DocumentoExtraido> {
  let mammoth: typeof import("mammoth");
  try {
    mammoth = await import("mammoth");
  } catch (err) {
    throw new DocumentExtractError("extract_failed", "Extrator DOCX indisponível.", err);
  }

  try {
    const htmlR = await mammoth.convertToHtml({ buffer });
    const rawR = await mammoth.extractRawText({ buffer });
    const html = String(htmlR.value ?? "");
    const raw = String(rawR.value ?? "").trim();
    const text = raw || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) {
      throw new DocumentExtractError("docx_invalid");
    }
    const cortado = text.slice(0, TETO_CHARS);
    const sections = headingsDoHtml(html);
    const fallback = sections.length > 0 ? sections : htmlParaSecoes(html || cortado);
    const warnings = [
      ...(htmlR.messages ?? [])
        .map((m) => m.message)
        .filter((m): m is string => typeof m === "string")
        .slice(0, 5),
      ...(text.length > TETO_CHARS ? ["Documento cortado no limite de caracteres."] : []),
    ];
    return {
      text: cortado,
      sections: fallback,
      metadata: {
        extractor: "mammoth",
        warnings,
        pageCount: 0,
        charCount: cortado.length,
        wordCount: cortado.split(/\s+/).filter(Boolean).length,
        ocrUsed: false,
      },
    };
  } catch (err) {
    if (err instanceof DocumentExtractError) throw err;
    throw new DocumentExtractError("docx_invalid", undefined, err);
  }
}
