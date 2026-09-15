import { env } from "@/lib/env";
import { r2Configurado, r2DocumentStorage } from "@/lib/ai/knowledge/storage/r2";
import { supabaseDocumentStorage } from "@/lib/ai/knowledge/storage/supabase";
import type { DocumentStorage, KnowledgeStorageProvider } from "@/lib/ai/knowledge/storage/tipos";

export function normalizarStorageProvider(raw: unknown): KnowledgeStorageProvider {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "r2" ? "r2" : "supabase";
}

export function storagePorNome(nome: KnowledgeStorageProvider): DocumentStorage {
  if (nome === "r2") return r2DocumentStorage();
  return supabaseDocumentStorage();
}

/**
 * PDF/DOCX de cliente não moram no disco da VPS.
 * Se o R2 está configurado, ele ganha — mesmo com KNOWLEDGE_STORAGE_PROVIDER=supabase.
 */
export function providerPadraoDoConhecimento(opts?: {
  providerEnv?: string;
  r2Pronto?: boolean;
}): KnowledgeStorageProvider {
  const r2 = opts?.r2Pronto ?? r2Configurado();
  if (r2) return "r2";
  return normalizarStorageProvider(opts?.providerEnv ?? env.KNOWLEDGE_STORAGE_PROVIDER);
}

/** Provider dos NOVOS uploads. Documentos antigos usam o gravado na metadata. */
export function storagePadrao(): DocumentStorage {
  return storagePorNome(providerPadraoDoConhecimento());
}

/** Reprocess / delete: lê o provider que CRIOU o objeto. */
export function storageDaFonte(meta: Record<string, unknown> | null | undefined): DocumentStorage {
  const gravado = normalizarStorageProvider(meta?.storage_provider);
  if (gravado === "r2") return r2DocumentStorage();
  return supabaseDocumentStorage();
}

export function chaveDaFonte(meta: Record<string, unknown> | null | undefined): string {
  if (typeof meta?.storage_key === "string" && meta.storage_key.length > 0) {
    return meta.storage_key;
  }
  if (typeof meta?.blob_path === "string") return meta.blob_path;
  return "";
}
