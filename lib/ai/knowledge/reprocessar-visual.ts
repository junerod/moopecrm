/**
 * Reprocessar fonte visual: relê o original, refaz extração + Vision,
 * substitui o derivado só quando o substituto é consistente.
 *
 * Se Vision falha e já havia derivado válido, o anterior permanece.
 * Sem coluna nova — vive no JSONB `source_metadata.processing`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { enriquecerDocumento, type Enriquecimento } from "@/lib/ai/knowledge/enriquecer";
import { chaveDaFonte, storageDaFonte } from "@/lib/ai/knowledge/storage/resolver";
import { ehExtensaoImagem } from "@/lib/ai/rag/extractors/imagem";
import { resolverExtensaoDocumental } from "@/lib/ai/rag/extractors/registro";
import {
  extrairPoliticaDoBuffer,
  type ExtensaoDePolitica,
} from "@/lib/ai/rag/ingest/policy";
import { logger } from "@/lib/logger";

export interface FundirReprocessamento {
  extra: Enriquecimento;
  anterior: Record<string, unknown>;
  agora?: Date;
}

export interface ResultadoFusaoVisual {
  meta: Record<string, unknown>;
  usouAnterior: boolean;
  derived_revision: number;
  vision_completed: boolean;
}

function revisaoAnterior(meta: Record<string, unknown>): number {
  const proc = meta.processing && typeof meta.processing === "object"
    ? (meta.processing as Record<string, unknown>)
    : {};
  return typeof proc.derived_revision === "number" ? proc.derived_revision : 0;
}

function derivadoAnteriorValido(meta: Record<string, unknown>): boolean {
  const chunks = Array.isArray(meta.derived_chunks) ? meta.derived_chunks : [];
  const proc = meta.processing && typeof meta.processing === "object"
    ? (meta.processing as Record<string, unknown>)
    : {};
  const pagesVision = typeof proc.pages_vision === "number" ? proc.pages_vision : 0;
  return chunks.length > 0 || pagesVision > 0;
}

function extraVisionOk(extra: Enriquecimento): boolean {
  return (
    extra.processing.pages_vision > 0 &&
    extra.processing.vision_status !== "unavailable" &&
    extra.derived_chunks.length > 0
  );
}

export function carimbarProcessamentoInicial(extra: Enriquecimento, agora?: Date): Enriquecimento["processing"] {
  const ok = extraVisionOk(extra);
  return {
    ...extra.processing,
    derived_revision: ok ? 1 : 0,
    vision_completed: ok,
    ...(ok ? { vision_processed_at: (agora ?? new Date()).toISOString() } : {}),
  };
}

export function fontePedeVision(meta: Record<string, unknown>, name: string): boolean {
  const filename = typeof meta.filename === "string" ? meta.filename : name;
  const mime = typeof meta.mime_type === "string" ? meta.mime_type : undefined;
  const ext = resolverExtensaoDocumental(filename, mime);
  return ext === "pdf" || (ext !== null && ehExtensaoImagem(ext));
}

/** Une o resultado novo com o metadata anterior sem apagar coleção/provenance. */
export function fundirReprocessamentoVisual(args: FundirReprocessamento): ResultadoFusaoVisual {
  const { extra, anterior } = args;
  const agora = (args.agora ?? new Date()).toISOString();
  const rev = revisaoAnterior(anterior);
  const ok = extraVisionOk(extra);
  const preservar = !ok && derivadoAnteriorValido(anterior);

  if (preservar) {
    const procAntigo =
      anterior.processing && typeof anterior.processing === "object"
        ? { ...(anterior.processing as Record<string, unknown>) }
        : {};
    return {
      usouAnterior: true,
      derived_revision: rev,
      vision_completed: false,
      meta: {
        ...anterior,
        processing: {
          ...procAntigo,
          ...extra.processing,
          pages_vision: typeof procAntigo.pages_vision === "number" ? procAntigo.pages_vision : extra.processing.pages_vision,
          vision_status: extra.processing.vision_status,
          extract_status:
            typeof anterior.extract_status === "string" && anterior.extract_status === "ready"
              ? "ready"
              : extra.processing.extract_status,
          vision_completed: false,
          vision_reprocess_preserved_previous: true,
          derived_revision: rev,
        },
      },
    };
  }

  const novaRev = ok ? rev + 1 : rev;
  return {
    usouAnterior: false,
    derived_revision: novaRev,
    vision_completed: ok,
    meta: {
      ...anterior,
      pages: extra.pages,
      extracted_text: extra.extractedText,
      visual_pages: extra.visual_pages,
      derived_chunks: extra.derived_chunks,
      derived: extra.derived,
      ...(extra.normalized_text ? { normalized_text: extra.normalized_text } : {}),
      extract_status: extra.processing.extract_status,
      char_count: extra.extractedText.length,
      chunk_count: Math.max(
        typeof anterior.chunk_count === "number" ? anterior.chunk_count : 0,
        extra.derived_chunks.length,
      ),
      processing: {
        ...extra.processing,
        derived_revision: novaRev,
        vision_completed: ok,
        ...(ok ? { vision_processed_at: agora } : {}),
        vision_reprocess_preserved_previous: false,
      },
    },
  };
}

export async function reprocessarFonteVisual(args: {
  organizationId: string;
  sourceId: string;
  name: string;
  meta: Record<string, unknown>;
  admin: SupabaseClient;
}): Promise<{
  aplicou: boolean;
  usouAnterior: boolean;
  derived_revision: number;
  vision_completed: boolean;
}> {
  const { organizationId, sourceId, name, meta, admin } = args;
  if (!fontePedeVision(meta, name)) {
    return { aplicou: false, usouAnterior: false, derived_revision: revisaoAnterior(meta), vision_completed: false };
  }

  const filename = typeof meta.filename === "string" ? meta.filename : name;
  const mime = typeof meta.mime_type === "string" ? meta.mime_type : undefined;
  const ext = resolverExtensaoDocumental(filename, mime) as ExtensaoDePolitica | null;
  if (!ext) {
    return { aplicou: false, usouAnterior: false, derived_revision: revisaoAnterior(meta), vision_completed: false };
  }

  const storage = storageDaFonte(meta);
  const key = chaveDaFonte(meta);
  if (!key) {
    return { aplicou: false, usouAnterior: false, derived_revision: revisaoAnterior(meta), vision_completed: false };
  }

  let buffer: Buffer;
  try {
    buffer = await storage.get({ organizationId, key });
  } catch (err) {
    logger.warn("knowledge.reprocess.storage", {
      source_id: sourceId,
      org_id: organizationId,
      erro: err instanceof Error ? err.message.slice(0, 240) : "get_failed",
    });
    const fusao = fundirReprocessamentoVisual({
      anterior: meta,
      extra: {
        pages: [],
        extractedText: "",
        visual_pages: [],
        derived_chunks: [],
        derived: {},
        processing: {
          pages_total: 1,
          pages_text: 0,
          pages_ocr: 0,
          pages_vision: 0,
          vision_status: "unavailable",
          extract_status: "vision_unavailable",
          vision_requested: false,
          vision_completed: false,
          derived_revision: revisaoAnterior(meta),
        },
      },
    });
    await persistirMeta(admin, organizationId, sourceId, fusao.meta, false);
    return {
      aplicou: true,
      usouAnterior: fusao.usouAnterior,
      derived_revision: fusao.derived_revision,
      vision_completed: false,
    };
  }

  const ingest = await extrairPoliticaDoBuffer(buffer, ext, filename);
  const extra = await enriquecerDocumento({
    buffer,
    ext,
    filename,
    pages: ingest.pages,
    extractedText: ingest.extractedText,
    ocrUsed: ingest.ocrUsed,
  });
  const fusao = fundirReprocessamentoVisual({ anterior: meta, extra });
  await persistirMeta(admin, organizationId, sourceId, fusao.meta, extraVisionOk(extra) && !fusao.usouAnterior);
  logger.info("knowledge.reprocess.vision", {
    source_id: sourceId,
    org_id: organizationId,
    provider: extra.processing.vision_provider,
    model: extra.processing.vision_model,
    vision_requested: extra.processing.vision_requested,
    vision_completed: extra.processing.vision_completed,
    latency_ms: extra.processing.vision_latency_ms,
    derived_revision: fusao.derived_revision,
    preserved_previous: fusao.usouAnterior,
  });
  return {
    aplicou: true,
    usouAnterior: fusao.usouAnterior,
    derived_revision: fusao.derived_revision,
    vision_completed: fusao.vision_completed,
  };
}

async function persistirMeta(
  admin: SupabaseClient,
  organizationId: string,
  sourceId: string,
  meta: Record<string, unknown>,
  atualizarFaq: boolean,
): Promise<void> {
  const extractStatus = typeof meta.extract_status === "string" ? meta.extract_status : null;
  await admin
    .from("ai_knowledge_sources")
    .update({
      source_metadata: meta,
      last_index_error: extractStatus === "needs_ocr" || extractStatus === "vision_unavailable"
        ? (typeof meta.error_code === "string" ? meta.error_code : extractStatus)
        : null,
    })
    .eq("id", sourceId)
    .eq("organization_id", organizationId);

  if (!atualizarFaq) return;
  const texto = typeof meta.extracted_text === "string" ? meta.extracted_text : "";
  if (!texto.trim()) return;

  const { data: faq } = await admin
    .from("ai_faq_items")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("knowledge_source_id", sourceId)
    .limit(1)
    .maybeSingle();

  if (faq?.id) {
    await admin
      .from("ai_faq_items")
      .update({ answer: texto.slice(0, 8000) })
      .eq("id", faq.id)
      .eq("organization_id", organizationId);
    return;
  }

  await admin.from("ai_faq_items").insert({
    organization_id: organizationId,
    knowledge_source_id: sourceId,
    question: `O que o documento registra?`,
    answer: texto.slice(0, 8000),
    tags: ["documento"],
    locale: "pt-BR",
    position: 0,
  });
}
