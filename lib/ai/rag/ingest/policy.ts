/**
 * Policy file ingestion helpers for the RAG pipeline.
 *
 * Supports PDF, Markdown and plain text. Text is extracted, split on
 * markdown headings first (semantic sections), then chunked at ~400 tokens
 * (~1600 chars) with ~50 token (~200 char) overlap.
 *
 * O embedding continua no rag-indexer. Esta função devolve os pedaços e o
 * texto normalizado — quem chama persiste e emite knowledge_source.updated.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText } from "@/lib/ai/rag/chunker";
import { extractPdfDocument, PdfExtractError } from "@/lib/ai/rag/extractors/pdf";
import { extractMarkdownText } from "@/lib/ai/rag/extractors/markdown";
import { logger } from "@/lib/logger";

export { PdfExtractError };

export const TETO_TEXTO_EXTRAIDO = 80_000;

// ~400 tokens × 4 chars/token ≈ 1600 chars
const POLICY_MAX_CHARS = 1600;
// ~50 tokens × 4 chars/token ≈ 200 chars
const POLICY_OVERLAP_CHARS = 200;

const HEADING_RE = /^#{1,2}\s+.+$/m;

export type ExtensaoDePolitica = "pdf" | "md" | "txt";

export interface PedacoDePolitica {
  content: string;
  page?: number;
}

export interface IngestPolicyArgs {
  organizationId: string;
  agentId: string;
  knowledgeSourceId: string;
  blobPath: string;
  ext: ExtensaoDePolitica;
}

export interface IngestPolicyResult {
  chunkCount: number;
  pageCount: number;
  charCount: number;
  chunks: PedacoDePolitica[];
  extractedText: string;
  pages: Array<{ pagina: number; texto: string }>;
}

export function normalizarTextoPolitica(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Splits policy text into overlapping chunks, respecting markdown heading
 * boundaries first before falling back to paragraph/sentence splitting.
 */
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
  paginas?: Array<{ pagina: number; texto: string }>,
): PedacoDePolitica[] {
  if (paginas && paginas.length > 0) {
    const out: PedacoDePolitica[] = [];
    for (const p of paginas) {
      for (const content of chunkPolicyText(p.texto)) {
        out.push({ content, page: p.pagina });
      }
    }
    return out;
  }
  return chunkPolicyText(texto).map((content) => ({ content }));
}

/**
 * Downloads a policy file from Supabase Storage, extracts text, and chunks it.
 * Throws `PdfExtractError` if PDF extraction fails or the file is image-only.
 */
export async function extrairPoliticaDoBuffer(
  buffer: Buffer,
  ext: ExtensaoDePolitica,
): Promise<IngestPolicyResult> {
  let extractedText: string;
  let pageCount = 0;
  let chunks: PedacoDePolitica[];
  let pages: Array<{ pagina: number; texto: string }> = [];

  if (ext === "pdf") {
    const doc = await extractPdfDocument(buffer);
    extractedText = normalizarTextoPolitica(doc.texto);
    pageCount = doc.pageCount;
    pages = doc.paginas.map((p) => ({
      pagina: p.pagina,
      texto: normalizarTextoPolitica(p.texto),
    }));
    chunks = pedacosDePolitica(extractedText, pages);
  } else {
    extractedText = normalizarTextoPolitica(extractMarkdownText(buffer));
    chunks = pedacosDePolitica(extractedText);
  }

  const capped = extractedText.slice(0, TETO_TEXTO_EXTRAIDO);
  return {
    chunkCount: chunks.length,
    pageCount,
    charCount: extractedText.length,
    chunks,
    extractedText: capped,
    pages,
  };
}

export async function ingestPolicyFile(args: IngestPolicyArgs): Promise<IngestPolicyResult> {
  const { organizationId, knowledgeSourceId, blobPath, ext } = args;
  const admin = createAdminClient();
  const t0 = Date.now();

  const { data: blob, error: downloadErr } = await admin.storage
    .from("ai-policy")
    .download(blobPath);

  if (downloadErr || !blob) {
    throw new Error(
      `[ai-policy-upload] Failed to download blob for org ${organizationId}: ${downloadErr?.message ?? "no data"}`,
    );
  }

  const result = await extrairPoliticaDoBuffer(Buffer.from(await blob.arrayBuffer()), ext);
  logger.info("policy.extracted", {
    source_id: knowledgeSourceId,
    org_id: organizationId,
    tipo: ext,
    page_count: result.pageCount,
    char_count: result.charCount,
    chunks: result.chunkCount,
    extract_ms: Date.now() - t0,
  });
  return result;
}
