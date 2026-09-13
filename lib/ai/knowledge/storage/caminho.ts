import { sanitizarNomeDoArquivo } from "@/lib/ai/rag/nome-do-arquivo";

/**
 * Path tenant-aware. Primeiro segmento = organization_id.
 * Serve Supabase (RLS por split_part) e R2 (prefixo do bucket).
 */
export function chaveDocumental(orgId: string, sourceId: string, filename: string): string {
  return `${orgId}/${sourceId}/${sanitizarNomeDoArquivo(filename)}`;
}

export function chavePertenceAOrg(key: string, orgId: string): boolean {
  return typeof key === "string" && key.startsWith(`${orgId}/`) && !key.includes("..");
}
