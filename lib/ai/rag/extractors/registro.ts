import type { DocumentoExtraido, ExtensaoDocumental, PedidoDeExtracao } from "@/lib/ai/rag/extractors/contrato";
import { extractDocx } from "@/lib/ai/rag/extractors/docx";
import { extractImagem, ehExtensaoImagem } from "@/lib/ai/rag/extractors/imagem";
import { extractPdfRobusto } from "@/lib/ai/rag/extractors/pdf-robusto";
import { extractMarkdownDocument, extractPlainText } from "@/lib/ai/rag/extractors/texto";
import { DocumentExtractError } from "@/lib/ai/knowledge/erros-documentais";

const MIME: Record<string, ExtensaoDocumental> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export function resolverExtensaoDocumental(
  filename?: string,
  mimeType?: string,
): ExtensaoDocumental | null {
  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || ext === "docx" || ext === "md" || ext === "txt") return ext;
  if (ext && ehExtensaoImagem(ext)) return ext === "jpeg" ? "jpg" : ext;
  if (mimeType && MIME[mimeType]) return MIME[mimeType];
  return null;
}

export async function extractDocument(pedido: PedidoDeExtracao): Promise<DocumentoExtraido> {
  const ext = resolverExtensaoDocumental(pedido.filename, pedido.mimeType);
  if (!ext) {
    throw new DocumentExtractError("unsupported_type");
  }
  if (ext === "pdf") return extractPdfRobusto(pedido.buffer);
  if (ext === "docx") return extractDocx(pedido.buffer);
  if (ext === "md") return extractMarkdownDocument(pedido.buffer);
  if (ehExtensaoImagem(ext)) return extractImagem(pedido.buffer, pedido.filename);
  return extractPlainText(pedido.buffer);
}
