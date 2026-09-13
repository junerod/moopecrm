/**
 * Policy file ingestion helpers for the RAG pipeline.
 *
 * PDF / DOCX / MD / TXT. Extração pelo registry; storage pelo DocumentStorage
 * gravado na metadata (supabase legado ou R2).
 */

import { chunkText } from "@/lib/ai/rag/chunker";
import { extractDocument } from "@/lib/ai/rag/extractors/registro";
import type { ExtensaoDocumental, PaginaOuSecao } from "@/lib/ai/rag/extractors/contrato";
import { PdfExtractError } from "@/lib/ai/rag/extractors/pdf";
import { DocumentExtractError } from "@/lib/ai/knowledge/erros-documentais";
import { chaveDaFonte, storageDaFonte } from "@/lib/ai/knowledge/storage/resolver";
import { logger } from "@/lib/logger";

export { PdfExtractError, DocumentExtractError };

export const TETO_TEXTO_EXTRAIDO = 80_000;

const POLICY_MAX_CHARS = 1600;
const POLICY_OVERLAP_CHARS = 200;

const HEADING_RE = /^#{1,2}\s+.+$/m;

export type ExtensaoDePolitica = ExtensaoDocumental;

export interface PedacoDePolitica {
  content: string;
  page?: number;
  section?: string;
}

export interface IngestPolicyArgs {
  organizationId: string;
  agentId: string;
  knowledgeSourceId: string;
  blobPath: string;
  ext: ExtensaoDePolitica;
  storageProvider?: string;
  storageKey?: string;
}

export interface IngestPolicyResult {
  chunkCount: number;
  pageCount: number;
  charCount: number;
  chunks: PedacoDePolitica[];
  extractedText: string;
  pages: PaginaOuSecao[];
  extractor: string;
  classification?: string;
  warnings: string[];
  ocrUsed: boolean;
  errorCode?: string;
}

export function normalizarTextoPolitica(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkPolicyText(text: string): string[] {
  const limpo = normalizarTextoPolitica(text);
  if (!limpo) return [];
  if (!HEADING_RE.test(limpo)) {
    return chunkText(limpo, { maxChars: POLICY_MAX_CHARS, overlapChars: POLICY_OVERLAP_CHARS });
  }

  const lines = limpo.split("\n");
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^#{1,2}\s+/.test(line) && current.length > 0) {
      const section = current.join("\n").trim();
      if (section.length > 0) sections.push(section);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    const section = current.join("\n").trim();
    if (section.length > 0) sections.push(section);
  }

  const chunks: string[] = [];
  for (const section of sections) {
    chunks.push(
      ...chunkText(section, {
        maxChars: POLICY_MAX_CHARS,
        overlapChars: POLICY_OVERLAP_CHARS,
      }),
    );
  }

  return chunks.filter((c) => c.length > 0);
}

export function pedacosDePolitica(
  texto: string,
  paginas?: PaginaOuSecao[],
): PedacoDePolitica[] {
  if (paginas && paginas.length > 0) {
    const out: PedacoDePolitica[] = [];
    for (const p of paginas) {
      for (const content of chunkPolicyText(p.texto)) {
        out.push({
          content,
          page: typeof p.pagina === "number" ? p.pagina : undefined,
          section: typeof p.secao === "string" && p.secao.length > 0 ? p.secao : undefined,
        });
      }
    }
    return out;
  }
  return chunkPolicyText(texto).map((content) => ({ content }));
}

export async function extrairPoliticaDoBuffer(
  buffer: Buffer,
  ext: ExtensaoDePolitica,
  filename?: string,
): Promise<IngestPolicyResult> {
  const mime =
    ext === "pdf"
      ? "application/pdf"
      : ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : ext === "md"
          ? "text/markdown"
          : "text/plain";

  const doc = await extractDocument({
    buffer,
    mimeType: mime,
    filename: filename ?? `arquivo.${ext}`,
  });

  const extractedText = normalizarTextoPolitica(doc.text);
  const pages = (doc.pages ?? doc.sections ?? []).map((p) => ({
    ...p,
    texto: normalizarTextoPolitica(p.texto),
  }));
  const chunks = pedacosDePolitica(extractedText, pages.length > 0 ? pages : undefined);
  const capped = extractedText.slice(0, TETO_TEXTO_EXTRAIDO);

  return {
    chunkCount: chunks.length,
    pageCount: doc.metadata.pageCount,
    charCount: extractedText.length,
    chunks,
    extractedText: capped,
    pages,
    extractor: doc.metadata.extractor,
    classification: doc.metadata.classification,
    warnings: doc.metadata.warnings,
    ocrUsed: doc.metadata.ocrUsed,
    errorCode: doc.metadata.errorCode,
  };
}

export async function ingestPolicyFile(args: IngestPolicyArgs): Promise<IngestPolicyResult> {
  const { organizationId, knowledgeSourceId, blobPath, ext } = args;
  const t0 = Date.now();
  const meta = {
    storage_provider: args.storageProvider,
    storage_key: args.storageKey ?? blobPath,
    blob_path: blobPath,
  };
  const storage = storageDaFonte(meta);
  const key = chaveDaFonte(meta);
  const buffer = await storage.get({ organizationId, key });
  const result = await extrairPoliticaDoBuffer(buffer, ext);
  logger.info("policy.extracted", {
    source_id: knowledgeSourceId,
    org_id: organizationId,
    tipo: ext,
    storage_provider: storage.provider,
    extractor: result.extractor,
    classification: result.classification,
    page_count: result.pageCount,
    char_count: result.charCount,
    chunks: result.chunkCount,
    ocr_used: result.ocrUsed,
    extract_ms: Date.now() - t0,
  });
  return result;
}
