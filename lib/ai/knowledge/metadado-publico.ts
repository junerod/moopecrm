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
  return out;
}

export function ehDocumentoArquivado(meta: Record<string, unknown> | null | undefined): boolean {
  return typeof meta?.filename === "string" && meta.filename.length > 0;
}
