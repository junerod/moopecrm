import { env } from "@/lib/env";
import { ocrConfigurado, ocrProviderNome } from "@/lib/ai/rag/ocr/resolver";
import { r2Configurado } from "@/lib/ai/knowledge/storage/r2";
import { normalizarStorageProvider } from "@/lib/ai/knowledge/storage/resolver";

/** Health técnico — sem secret, sem rota pública nesta rodada. */
export function saudeDoConhecimento(): {
  storage: { provider: string; r2: "conectado" | "nao_configurado" };
  embedding: "configurado" | "ausente";
  ocr: "configurado" | "nao_configurado";
} {
  const provider = normalizarStorageProvider(env.KNOWLEDGE_STORAGE_PROVIDER);
  return {
    storage: {
      provider,
      r2: r2Configurado() ? "conectado" : "nao_configurado",
    },
    embedding: env.OPENAI_API_KEY ? "configurado" : "ausente",
    ocr: ocrConfigurado() ? "configurado" : "nao_configurado",
  };
}

export function descricaoOcr(): string {
  if (!ocrConfigurado()) return "Não configurado";
  return ocrProviderNome();
}
