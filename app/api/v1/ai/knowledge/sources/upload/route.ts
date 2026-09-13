/**
 * POST /api/v1/ai/knowledge/sources/upload
 *
 * Multipart: PDF, Markdown ou TXT (máx. 20MB). Grava no bucket privado
 * `ai-policy`, valida extração, registra a fonte e emite
 * knowledge_source.updated para o rag-indexer.
 *
 * organization_id vem do JWT — NUNCA do body. Path no Storage é
 * `{orgId}/{uuid}.{ext}` — o nome do arquivo do usuário só entra em metadata.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extrairPoliticaDoBuffer, PdfExtractError, type ExtensaoDePolitica } from "@/lib/ai/rag/ingest/policy";
import { sanitizarNomeDoArquivo } from "@/lib/ai/rag/nome-do-arquivo";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/markdown",
  "text/x-markdown",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set(["pdf", "md", "txt"]);

function resolveExt(filename: string, mimeType: string): ExtensaoDePolitica | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "pdf" || ext === "md" || ext === "txt") return ext;
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/plain") return "txt";
  if (mimeType === "text/markdown" || mimeType === "text/x-markdown") return "md";
  return null;
}

const nameSchema = z.string().min(2).max(120);
const agentIdSchema = z.string().uuid();

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
  const ext = resolveExt(file.name, mimeType);
  const extDoNome = file.name.split(".").pop()?.toLowerCase() ?? "";
  const isMimeAllowed = ALLOWED_MIME_TYPES.has(mimeType) || ALLOWED_EXTENSIONS.has(extDoNome);

  if (!isMimeAllowed || !ext) {
    return fail(
      "unsupported_media_type",
      "Tipo de arquivo não suportado. Envie PDF, Markdown ou TXT (.pdf, .md, .txt).",
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
    ingest = await extrairPoliticaDoBuffer(fileBuffer, ext);
  } catch (err) {
    logger.warn("knowledge.upload.extract", {
      request_id: requestId,
      org_id: activeOrg.orgId,
      tipo: ext,
      erro: err instanceof Error ? err.message.slice(0, 240) : "extract_failed",
    });
    if (err instanceof PdfExtractError) {
      return fail(
        "unprocessable_entity",
        "Não foi possível encontrar texto neste documento.",
        422,
        { requestId },
      );
    }
    return fail("internal_error", "Erro ao processar o arquivo.", 500, { requestId });
  }

  const blobId = randomUUID();
  const blobPath = `${activeOrg.orgId}/${blobId}.${ext}`;
  const admin = createAdminClient();

  const { error: uploadErr } = await admin.storage
    .from("ai-policy")
    .upload(blobPath, fileBuffer, { contentType: mimeType || `application/${ext}`, upsert: false });

  if (uploadErr) {
    logger.error("knowledge.upload.storage", { request_id: requestId, erro: uploadErr.message });
    return fail("internal_error", "Erro ao fazer upload do arquivo.", 500, { requestId });
  }

  const sourceMetadata = {
    filename: nomeArquivo,
    blob_path: blobPath,
    version: 1,
    uploaded_by: authUser.id,
    mime_type: mimeType || `application/${ext}`,
    size_bytes: file.size,
    chunk_count: ingest.chunkCount,
    page_count: ingest.pageCount,
    char_count: ingest.charCount,
    extracted_text: ingest.extractedText,
    pages: ingest.pages,
  };

  const { data: ks, error: ksErr } = await admin
    .from("ai_knowledge_sources")
    .insert({
      organization_id: activeOrg.orgId,
      agent_id: agentIdParsed.data,
      source_type: "policy",
      name: nameParsed.data,
      status: "ready",
      ingested_at: new Date().toISOString(),
      source_metadata: sourceMetadata,
    })
    .select("id")
    .single();

  if (ksErr || !ks) {
    await admin.storage.from("ai-policy").remove([blobPath]);
    logger.error("knowledge.upload.insert", { request_id: requestId, erro: ksErr?.message });
    return fail("internal_error", "Erro ao registrar fonte de conhecimento.", 500, { requestId });
  }

  const ksId = (ks as { id: string }).id;

  // O Testar e o Copilot já leem `ai_faq_items` quando o vetor ainda não
  // rodou. Sem esta linha, um PDF indexado só existia no blob — a pergunta
  // de confiança voltava vazia até o embedder (que o e2e muitas vezes não tem).
  const { error: faqErr } = await admin.from("ai_faq_items").insert({
    organization_id: activeOrg.orgId,
    knowledge_source_id: ksId,
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
    p_entity_id: ksId,
    p_payload: {
      knowledge_source_id: ksId,
      agent_id: agentIdParsed.data,
      source_type: "policy",
    },
    p_organization_id: activeOrg.orgId,
  } as never);

  if (emitErr) {
    logger.warn("knowledge.upload.emit", { request_id: requestId, erro: emitErr.message });
  }

  void audit({
    action: "knowledge.source_uploaded",
    actorUserId: authUser.id,
    organizationId: activeOrg.orgId,
    resourceType: "ai_knowledge_source",
    resourceId: ksId,
    requestId,
    metadata: { ext, size_bytes: file.size, chunks: ingest.chunkCount },
  });

  logger.info("knowledge.upload.ok", {
    source_id: ksId,
    org_id: activeOrg.orgId,
    tipo: ext,
    status: "ready",
    chunks: ingest.chunkCount,
    extract_ms: Date.now() - t0,
  });

  return ok({ id: ksId, name: nameParsed.data, status: "ready" }, { status: 201, requestId });
}
