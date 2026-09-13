import { env } from "@/lib/env";
import { ocrConfigurado, ocrProviderNome } from "@/lib/ai/rag/ocr/resolver";
import { r2Configurado } from "@/lib/ai/knowledge/storage/r2";
import { normalizarStorageProvider } from "@/lib/ai/knowledge/storage/resolver";
import { diagnosticoVision } from "@/lib/ai/knowledge/visual/analisar";

/** Health técnico — sem secret. */
export function saudeDoConhecimento(): {
  storage: { provider: string; r2: "conectado" | "nao_configurado" };
  embedding: "configurado" | "ausente";
  ocr: "configurado" | "nao_configurado";
  vision: {
    available: boolean;
    provider: string | null;
    model: string | null;
    image_capability: boolean;
    resolvable: boolean;
    missing?: string;
  };
} {
  const provider = normalizarStorageProvider(env.KNOWLEDGE_STORAGE_PROVIDER);
  const v = diagnosticoVision();
  return {
    storage: {
      provider,
      r2: r2Configurado() ? "conectado" : "nao_configurado",
    },
    embedding: env.OPENAI_API_KEY ? "configurado" : "ausente",
    ocr: ocrConfigurado() ? "configurado" : "nao_configurado",
    vision: {
      available: v.ok,
      provider: v.ok ? v.provider : v.provider || null,
      model: v.ok ? v.model : null,
      image_capability: v.image_capability,
      resolvable: v.resolvable,
      ...(v.missing ? { missing: v.missing } : {}),
    },
  };
}

export function descricaoOcr(): string {
  if (!ocrConfigurado()) return "Não configurado";
  return ocrProviderNome();
}
