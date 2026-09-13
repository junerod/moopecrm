/**
 * Códigos e mensagens do pipeline documental.
 * O frontend só traduz o código — nunca o stack do parser.
 */

export const CodigosErroDocumental = {
  pdf_no_text: "pdf_no_text",
  pdf_needs_ocr: "pdf_needs_ocr",
  pdf_encrypted: "pdf_encrypted",
  pdf_corrupt: "pdf_corrupt",
  docx_invalid: "docx_invalid",
  unsupported_type: "unsupported_type",
  extract_failed: "extract_failed",
  storage_failed: "storage_failed",
  index_failed: "index_failed",
} as const;

export type CodigoErroDocumental =
  (typeof CodigosErroDocumental)[keyof typeof CodigosErroDocumental];

const MENSAGENS: Record<CodigoErroDocumental, string> = {
  pdf_no_text: "Não foi possível encontrar texto pesquisável neste PDF.",
  pdf_needs_ocr:
    "Este PDF parece ser digitalizado e não contém texto pesquisável. Ative OCR ou envie uma versão com texto.",
  pdf_encrypted: "Este PDF é protegido por senha e não pode ser processado.",
  pdf_corrupt: "Este PDF está danificado e não pode ser lido.",
  docx_invalid: "Este DOCX está inválido ou vazio.",
  unsupported_type: "Tipo de arquivo não suportado. Envie PDF, DOCX, Markdown ou TXT.",
  extract_failed: "Não consegui extrair o conteúdo deste documento.",
  storage_failed: "Não consegui gravar o arquivo. Tente de novo.",
  index_failed: "Não foi possível indexar este documento.",
};

export function mensagemDoErroDocumental(codigo: string): string {
  if (codigo in MENSAGENS) return MENSAGENS[codigo as CodigoErroDocumental];
  return MENSAGENS.extract_failed;
}

export class DocumentExtractError extends Error {
  constructor(
    public readonly code: CodigoErroDocumental,
    message?: string,
    public readonly cause?: unknown,
  ) {
    super(message ?? mensagemDoErroDocumental(code));
    this.name = "DocumentExtractError";
  }
}
