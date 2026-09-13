import { DocumentExtractError } from "@/lib/ai/knowledge/erros-documentais";
import type { DocumentoExtraido } from "@/lib/ai/rag/extractors/contrato";

export type ExtensaoImagem = "png" | "jpg" | "jpeg" | "webp";

export function bufferPareceImagem(buffer: Buffer): ExtensaoImagem | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export function extractImagem(buffer: Buffer, filename?: string): DocumentoExtraido {
  const tipo = bufferPareceImagem(buffer);
  if (!tipo) {
    throw new DocumentExtractError("unsupported_type", "Arquivo de imagem inválido.");
  }
  const nome = filename?.trim() || `imagem.${tipo}`;
  return {
    text: "",
    pages: [{ secao: nome, texto: "" }],
    metadata: {
      extractor: "image",
      warnings: ["Imagem sem texto nativo — depende de análise visual."],
      pageCount: 1,
      charCount: 0,
      wordCount: 0,
      ocrUsed: false,
    },
  };
}

export function ehExtensaoImagem(ext: string): ext is ExtensaoImagem {
  return ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "webp";
}
