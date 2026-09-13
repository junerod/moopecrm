/**
 * POST /api/v1/ai/knowledge/sources/:id/reindex
 *
 * Emite `knowledge_source.updated` para o worker re-processar a fonte.
 * Não persiste estado transitório — o schema só aceita
 * `last_index_status IN (NULL, 'failed', 'partial')`. O "queued" é puramente
 * client-side via mutation.isPending; o worker eventualmente atualiza
 * `last_indexed_at` / `chunks_count` / `last_index_status`.
 *
 * Auth: cookie session, role >= manager.
 * organization_id é resolvido do JWT — nunca do body/path.
 */

import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reprocessarFonteVisual } from "@/lib/ai/knowledge/reprocessar-visual";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const reindexBodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .partial()
  .optional();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await params;

  const authz = await requireRole("manager", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return authz.response;
  const { user: authUser, org: activeOrg } = authz;

  // Body é opcional; se vier, valida.
  if (req.headers.get("content-length") && req.headers.get("content-length") !== "0") {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      raw = undefined;
    }
    if (raw !== undefined && raw !== null) {
      const parsed = reindexBodySchema.safeParse(raw);
      if (!parsed.success) {
        return fail("validation_failed", "Campos inválidos.", 422, {
          requestId,
          details: parsed.error.flatten(),
        });
      }
    }
  }

  // Valida ownership via cliente user-scoped (RLS).
  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("ai_knowledge_sources")
    .select("id, agent_id, source_type, name, source_metadata")
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId)
    .maybeSingle();

  if (fetchErr) {
    logger.error("knowledge.reindex.fetch", { request_id: requestId, erro: fetchErr.message });
    return fail("internal_error", "Erro ao verificar fonte.", 500, { requestId });
  }
  if (!existing) {
    return fail("not_found", "Fonte de conhecimento não encontrada.", 404, { requestId });
  }

  const ksRow = existing as {
    id: string;
    agent_id: string;
    source_type: string;
    name: string;
    source_metadata: Record<string, unknown> | null;
  };

  const admin = createAdminClient();

  // Limpa o erro anterior ANTES do Vision — o reprocess pode gravar um novo.
  const { error: clearErr } = await admin
    .from("ai_knowledge_sources")
    .update({ last_index_error: null })
    .eq("id", id)
    .eq("organization_id", activeOrg.orgId);

  if (clearErr) {
    logger.warn("knowledge.reindex.clear_error", { request_id: requestId, erro: clearErr.message });
  }

  let vision: {
    aplicou: boolean;
    usouAnterior: boolean;
    derived_revision: number;
    vision_completed: boolean;
  } | null = null;
  try {
    vision = await reprocessarFonteVisual({
      organizationId: activeOrg.orgId,
      sourceId: id,
      name: ksRow.name,
      meta: (ksRow.source_metadata ?? {}) as Record<string, unknown>,
      admin,
    });
  } catch (err) {
    logger.warn("knowledge.reindex.vision", {
      request_id: requestId,
      source_id: id,
      erro: err instanceof Error ? err.message.slice(0, 240) : "vision_reprocess_failed",
    });
  }

  // Emit knowledge_source.updated (fire-and-forget).
  const { error: emitErr } = await admin.rpc("emit_event" as never, {
    p_event_type: "knowledge_source.updated",
    p_entity_kind: "ai_knowledge_source",
    p_entity_id: id,
    p_payload: {
      knowledge_source_id: id,
      agent_id: ksRow.agent_id,
      source_type: ksRow.source_type,
      triggered_by: "manual_reindex",
    },
    p_organization_id: activeOrg.orgId,
  } as never);

  if (emitErr) {
    console.warn("[ai-knowledge-reindex] emit_event failed (non-blocking):", emitErr.message);
  }

  void audit({
    action: "knowledge.source_reindexed",
    actorUserId: authUser.id,
    organizationId: activeOrg.orgId,
    resourceType: "ai_knowledge_source",
    resourceId: id,
    requestId,
    metadata: {
      source_type: ksRow.source_type,
      vision_reprocess: vision?.aplicou === true,
      vision_completed: vision?.vision_completed === true,
      derived_revision: vision?.derived_revision,
    },
  });

  return ok(
    {
      id,
      queued: true as const,
      agent_id: ksRow.agent_id,
      vision_reprocess: vision?.aplicou === true,
      vision_completed: vision?.vision_completed === true,
      derived_revision: vision?.derived_revision ?? null,
      preserved_previous: vision?.usouAnterior === true,
    },
    { requestId },
  );
}
