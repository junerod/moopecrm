/**
 * Original ≠ IA. O retrieval pode usar trecho derivado; a citação
 * obrigatoriamente aponta o arquivo/página reais.
 */

export type ContentKind = "original" | "ai_derived";

export type DerivedFrom =
  | "visual_page"
  | "visual_image"
  | "normalization"
  | "structured";

export interface ProvenienciaDoTrecho {
  content_kind: ContentKind;
  derived_from?: DerivedFrom;
  generated_by_ai: boolean;
  model?: string;
  confidence?: number;
  filename: string;
  page?: number;
  section?: string;
}

export function citacaoDaFonteOriginal(p: {
  filename?: string | null;
  page?: number;
  section?: string;
  content_kind?: unknown;
}): { rotulo: string; pagina?: number; secao?: string } {
  const nome = (p.filename ?? "").trim() || "Documento";
  const pagina = typeof p.page === "number" && p.page > 0 ? p.page : undefined;
  const secao = typeof p.section === "string" && p.section.trim() ? p.section.trim() : undefined;
  return {
    rotulo: pagina !== undefined ? `${nome} · página ${pagina}` : nome,
    ...(pagina !== undefined ? { pagina } : {}),
    ...(secao ? { secao } : {}),
  };
}

export function metadadoDeChunk(p: ProvenienciaDoTrecho): Record<string, unknown> {
  return {
    filename: p.filename,
    content_kind: p.content_kind,
    generated_by_ai: p.generated_by_ai,
    ...(p.derived_from ? { derived_from: p.derived_from } : {}),
    ...(p.model ? { model: p.model } : {}),
    ...(typeof p.confidence === "number" ? { confidence: p.confidence } : {}),
    ...(typeof p.page === "number" ? { page: p.page } : {}),
    ...(p.section ? { section: p.section } : {}),
  };
}

export function ehTrechoDerivado(meta: Record<string, unknown> | null | undefined): boolean {
  return meta?.content_kind === "ai_derived" || meta?.generated_by_ai === true;
}
