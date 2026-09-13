/**
 * O que a API pode devolver ao browser. Nunca blob_path, texto extraído
 * completo, uploaded_by ou qualquer path de Storage.
 */
export function metadadoPublicoDaFonte(
  meta: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, unknown> = {};
  if (typeof meta.filename === "string") out.filename = meta.filename;
  if (typeof meta.mime_type === "string") out.mime_type = meta.mime_type;
  if (typeof meta.size_bytes === "number") out.size_bytes = meta.size_bytes;
  if (typeof meta.page_count === "number") out.page_count = meta.page_count;
  if (typeof meta.char_count === "number") out.char_count = meta.char_count;
  if (typeof meta.chunk_count === "number") out.chunk_count = meta.chunk_count;
  if (typeof meta.extract_status === "string") out.extract_status = meta.extract_status;
  if (typeof meta.extract_classification === "string") {
    out.extract_classification = meta.extract_classification;
  }
  if (typeof meta.error_code === "string") out.error_code = meta.error_code;
  if (typeof meta.ocr_used === "boolean") out.ocr_used = meta.ocr_used;
  if (typeof meta.extractor === "string") out.extractor = meta.extractor;
  if (Array.isArray(meta.warnings)) {
    out.warnings = meta.warnings.filter((w): w is string => typeof w === "string").slice(0, 5);
  }
  return out;
}

export function ehDocumentoArquivado(meta: Record<string, unknown> | null | undefined): boolean {
  return typeof meta?.filename === "string" && meta.filename.length > 0;
}
