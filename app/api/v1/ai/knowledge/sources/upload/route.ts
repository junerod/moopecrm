/**
 * POST /api/v1/ai/knowledge/sources/upload
 *
 * Multipart: PDF, DOCX, Markdown ou TXT (máx. 20MB).
 * Storage via DocumentStorage (supabase default ou R2).
 * organization_id vem do JWT — NUNCA do body.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DocumentExtractError,
  extrairPoliticaDoBuffer,
  type ExtensaoDePolitica,
} from "@/lib/ai/rag/ingest/policy";
import { sanitizarNomeDoArquivo } from "@/lib/ai/rag/nome-do-arquivo";
import {
  DocumentExtractError as ErroDoc,
  mensagemDoErroDocumental,
} from "@/lib/ai/knowledge/erros-documentais";
import { chaveDocumental } from "@/lib/ai/knowledge/storage/caminho";
import { storagePadrao } from "@/lib/ai/knowledge/storage/resolver";
import { resolverExtensaoDocumental } from "@/lib/ai/rag/extractors/registro";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "md", "txt"]);

const nameSchema = z.string().min(2).max(120);
const agentIdSchema = z.string().uuid();

function codigoHttpDoExtract(code: string): number {
  if (code === "unsupported_type") return 415;
  return 422;
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("manager", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return authz.response;
  const { user: authUser, org: activeOrg } = authz;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail("invalid_request", "Falha ao processar multipart/form-data.", 400, { requestId });
  }

  const fileEntry = formData.get("file");
  const agentIdRaw = formData.get("agent_id");
  const nameRaw = formData.get("name");

  if (!(fileEntry instanceof File)) {
    return fail("invalid_request", "Campo 'file' ausente ou inválido.", 400, { requestId });
  }

  const agentIdParsed = agentIdSchema.safeParse(agentIdRaw);
  if (!agentIdParsed.success) {
    return fail("validation_failed", "Campo 'agent_id' deve ser UUID válido.", 422, { requestId });
  }

  const file = fileEntry;
  const nomeArquivo = sanitizarNomeDoArquivo(file.name);
  const nameParsed = nameSchema.safeParse(
    typeof nameRaw === "string" && nameRaw.trim().length >= 2 ? nameRaw.trim() : nomeArquivo,
  );
  if (!nameParsed.success) {
    return fail("validation_failed", "Campo 'name' inválido (2-120 chars).", 422, { requestId });
  }

  if (file.size > MAX_FILE_SIZE) {
    return fail("payload_too_large", "Arquivo excede o limite de 20MB.", 413, { requestId });
  }

  const mimeType = file.type;
  const ext = resolverExtensaoDocumental(file.name, mimeType) as ExtensaoDePolitica | null;
  const extDoNome = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (!ALLOWED_EXTENSIONS.has(extDoNome) || !ext) {
    return fail(
      "unsupported_media_type",
      mensagemDoErroDocumental("unsupported_type"),
      415,
      { requestId },
    );
  }

  const supabase = await createClient();
  const { data: agent, error: agentErr } = await supabase
    .from("ai_agents")
    .select("id")
    .eq("id", agentIdParsed.data)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  if (agentErr) {
    logger.error("knowledge.upload.agent_lookup", { request_id: requestId, erro: agentErr.message });
    return fail("internal_error", "Erro ao validar agent_id.", 500, { requestId });
  }
  if (!agent) {
    return fail("not_found", "Agent não encontrado nesta organização.", 404, { requestId });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const t0 = Date.now();
  let ingest: Awaited<ReturnType<typeof extrairPoliticaDoBuffer>>;
  try {
    ingest = await extrairPoliticaDoBuffer(fileBuffer, ext, nomeArquivo);
  } catch (err) {
    const code =
      err instanceof ErroDoc || err instanceof DocumentExtractError
        ? err.code
        : "extract_failed";
    logger.warn("knowledge.upload.extract", {
      request_id: requestId,
      org_id: activeOrg.orgId,
      tipo: ext,
      error_code: code,
      erro: err instanceof Error ? err.message.slice(0, 240) : "extract_failed",
    });
    return fail(
      code,
      mensagemDoErroDocumental(code),
      codigoHttpDoExtract(code),
      { requestId },
    );
  }

  const needsOcr = ingest.errorCode === "pdf_needs_ocr" && ingest.charCount < 40;
  const storage = storagePadrao();
  const sourceId = randomUUID();
  const storageKey = chaveDocumental(activeOrg.orgId, sourceId, nomeArquivo);
  const contentType =
    mimeType ||
    (ext === "pdf"
      ? "application/pdf"
      : ext === "docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : ext === "md"
          ? "text/markdown"
          : "text/plain");

  try {
    await storage.put({
      organizationId: activeOrg.orgId,
      key: storageKey,
      body: fileBuffer,
      contentType,
    });
  } catch (err) {
    logger.error("knowledge.upload.storage", {
      request_id: requestId,
      provider: storage.provider,
      erro: err instanceof Error ? err.message : "storage_failed",
    });
    return fail("storage_failed", mensagemDoErroDocumental("storage_failed"), 500, { requestId });
  }

  const extractStatus = needsOcr ? "needs_ocr" : "ready";
  const sourceMetadata = {
    filename: nomeArquivo,
    blob_path: storageKey,
    storage_provider: storage.provider,
    storage_key: storageKey,
    version: 1,
    uploaded_by: authUser.id,
    mime_type: contentType,
    size_bytes: file.size,
    chunk_count: ingest.chunkCount,
    page_count: ingest.pageCount,
    char_count: ingest.charCount,
    extracted_text: ingest.extractedText,
    pages: ingest.pages,
    extract_status: extractStatus,
    extract_classification: ingest.classification ?? null,
    extractor: ingest.extractor,
    ocr_used: ingest.ocrUsed,
    warnings: ingest.warnings,
    error_code: ingest.errorCode ?? null,
  };

  const admin = createAdminClient();
  const { error: ksErr } = await admin.from("ai_knowledge_sources").insert({
    id: sourceId,
    organization_id: activeOrg.orgId,
    agent_id: agentIdParsed.data,
    source_type: "policy",
    name: nameParsed.data,
    status: "ready",
    last_index_error: needsOcr ? mensagemDoErroDocumental("pdf_needs_ocr") : null,
    ingested_at: new Date().toISOString(),
    source_metadata: sourceMetadata,
  });

  if (ksErr) {
    try {
      await storage.delete({ organizationId: activeOrg.orgId, key: storageKey });
    } catch {
      /* rollback best-effort */
    }
    logger.error("knowledge.upload.insert", { request_id: requestId, erro: ksErr.message });
    return fail("internal_error", "Erro ao registrar fonte de conhecimento.", 500, { requestId });
  }

  if (!needsOcr && ingest.extractedText) {
    const { error: faqErr } = await admin.from("ai_faq_items").insert({
      organization_id: activeOrg.orgId,
      knowledge_source_id: sourceId,
      question: `O que o documento ${nameParsed.data} registra?`,
      answer: ingest.extractedText.slice(0, 8000),
      tags: ["documento"],
      locale: "pt-BR",
      position: 0,
    });
    if (faqErr) {
      logger.warn("knowledge.upload.faq_item", { request_id: requestId, erro: faqErr.message });
    }

    const { error: emitErr } = await admin.rpc("emit_event" as never, {
      p_event_type: "knowledge_source.updated",
      p_entity_kind: "ai_knowledge_source",
      p_entity_id: sourceId,
      p_payload: {
        knowledge_source_id: sourceId,
        agent_id: agentIdParsed.data,
        source_type: "policy",
      },
      p_organization_id: activeOrg.orgId,
    } as never);
    if (emitErr) {
      logger.warn("knowledge.upload.emit", { request_id: requestId, erro: emitErr.message });
    }
  }

  void audit({
    action: "knowledge.source_uploaded",
    actorUserId: authUser.id,
    organizationId: activeOrg.orgId,
    resourceType: "ai_knowledge_source",
    resourceId: sourceId,
    requestId,
    metadata: {
      ext,
      size_bytes: file.size,
      chunks: ingest.chunkCount,
      storage_provider: storage.provider,
      extractor: ingest.extractor,
      classification: ingest.classification,
      ocr_used: ingest.ocrUsed,
      error_code: ingest.errorCode ?? null,
    },
  });

  logger.info("knowledge.upload.ok", {
    source_id: sourceId,
    org_id: activeOrg.orgId,
    tipo: ext,
    storage_provider: storage.provider,
    extractor: ingest.extractor,
    classification: ingest.classification,
    status: extractStatus,
    chunks: ingest.chunkCount,
    ocr_used: ingest.ocrUsed,
    extract_ms: Date.now() - t0,
  });

  return ok(
    {
      id: sourceId,
      name: nameParsed.data,
      status: extractStatus,
      extract_status: extractStatus,
      error_code: ingest.errorCode ?? null,
      message: needsOcr ? mensagemDoErroDocumental("pdf_needs_ocr") : undefined,
    },
    { status: 201, requestId },
  );
}
