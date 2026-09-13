import type { CodigoErroDocumental } from "@/lib/ai/knowledge/erros-documentais";

export type ClassificacaoPdf =
  | "TEXTUAL"
  | "LOW_TEXT"
  | "IMAGE_ONLY"
  | "ENCRYPTED"
  | "CORRUPT"
  | "UNSUPPORTED";

export type ExtensaoDocumental = "pdf" | "docx" | "md" | "txt" | "png" | "jpg" | "jpeg" | "webp";

export interface PaginaOuSecao {
  pagina?: number;
  secao?: string;
  texto: string;
}

export interface MetadadoDaExtracao {
  extractor: string;
  classification?: ClassificacaoPdf;
  warnings: string[];
  pageCount: number;
  charCount: number;
  wordCount: number;
  emptyPageRatio?: number;
  ocrUsed: boolean;
  errorCode?: CodigoErroDocumental;
}

export interface DocumentoExtraido {
  text: string;
  pages?: PaginaOuSecao[];
  sections?: PaginaOuSecao[];
  metadata: MetadadoDaExtracao;
}

export interface PedidoDeExtracao {
  buffer: Buffer;
  mimeType?: string;
  filename?: string;
}
