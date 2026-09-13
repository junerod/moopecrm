/**
 * POST /api/v1/ai/knowledge/organizar
 *
 * Sugere uma versão organizada do texto. NUNCA grava na base.
 * Usa o mesmo gateway/provider da instalação — sem chave do usuário.
 */

import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { generateText } from "ai";
import { z } from "zod";

import {
  montarPromptOrganizar,
  PROMPT_ORGANIZAR_CONHECIMENTO,
} from "@/lib/ai/knowledge/organizar";
import { DEFAULT_BOT_MODEL, resolveLanguageModel } from "@/lib/ai/gateway";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  texto: z.string().trim().min(8).max(20_000),
  assunto: z.string().trim().max(120).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return authz.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail("invalid_request", "Body JSON inválido.", 400, { requestId });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Cole o texto que deseja organizar.", 422, { requestId });
  }

  const model = resolveLanguageModel(DEFAULT_BOT_MODEL);
  if (!model) {
    return fail(
      "service_unavailable",
      "A organização com IA não está disponível nesta instalação.",
      503,
      { requestId },
    );
  }

  try {
    const result = await generateText({
      model,
      system: PROMPT_ORGANIZAR_CONHECIMENTO,
      prompt: montarPromptOrganizar(parsed.data.texto, parsed.data.assunto),
    });
    const organizado = result.text.trim();
    if (!organizado) {
      return fail("internal_error", "A IA não devolveu uma versão organizada.", 502, { requestId });
    }
    return ok({ organizado }, { requestId });
  } catch (err) {
    logger.warn("knowledge.organizar.failed", {
      request_id: requestId,
      org_id: authz.org.orgId,
      erro: err instanceof Error ? err.message.slice(0, 240) : "organize_failed",
    });
    return fail("internal_error", "Não consegui organizar o texto agora.", 502, { requestId });
  }
}
