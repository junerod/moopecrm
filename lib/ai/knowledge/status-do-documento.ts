export type StatusDocumento =
  | "enviando"
  | "processando"
  | "lendo"
  | "analisando_imagens"
  | "organizando"
  | "indexando"
  | "pronto"
  | "erro"
  | "ocr_necessario"
  | "ocr"
  | "vision_indisponivel";

export function statusDoDocumento(s: {
  status: string | null;
  last_index_status: string | null;
  last_indexed_at: string | null;
  chunks_count: number | null;
  source_metadata?: Record<string, unknown> | null;
}): StatusDocumento {
  const extract =
    typeof s.source_metadata?.extract_status === "string"
      ? s.source_metadata.extract_status
      : "";
  if (extract === "ocr_processing") return "ocr";
  if (extract === "needs_ocr" || s.source_metadata?.error_code === "pdf_needs_ocr") {
    return "ocr_necessario";
  }
  if (extract === "vision_unavailable") return "vision_indisponivel";
  if (extract === "analyzing_visual") return "analisando_imagens";
  if (extract === "organizing") return "organizando";
  if (extract === "extracting") return "lendo";
  if (s.status === "failed" || s.last_index_status === "failed") return "erro";
  if (s.status === "building") return "processando";
  if (s.last_index_status === "success" && (s.chunks_count ?? 0) > 0) return "pronto";
  if (s.status === "ready" && !s.last_indexed_at) return "indexando";
  if (s.last_index_status === "partial") return "indexando";
  if ((s.chunks_count ?? 0) > 0) return "pronto";
  return "indexando";
}

export function rotuloDoStatus(status: StatusDocumento): string {
  switch (status) {
    case "enviando":
      return "Enviando";
    case "processando":
      return "Lendo documento";
    case "lendo":
      return "Lendo documento";
    case "analisando_imagens":
      return "Analisando imagens";
    case "organizando":
      return "Organizando conhecimento";
    case "indexando":
      return "Indexando";
    case "pronto":
      return "Pronto";
    case "erro":
      return "Erro";
    case "ocr_necessario":
      return "OCR necessário";
    case "ocr":
      return "Processando OCR";
    case "vision_indisponivel":
      return "Análise visual indisponível";
  }
}
