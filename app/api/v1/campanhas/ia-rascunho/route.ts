/**
 * POST /api/v1/campanhas/ia-rascunho — só altera DRAFT.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { authorizeAiAction } from "@/lib/ai/acoes/autorizar";
import { ACOES_DE_RASCUNHO, reescreverRascunhoLocal } from "@/lib/campanhas/ia-rascunho";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  texto: z.string().max(2000),
  acao: z.enum(ACOES_DE_RASCUNHO),
});

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;

  const ia = authorizeAiAction({ action: "campaign_dispatch", ai_mode: "copilot" });
  if (ia.verdict === "ALLOW") {
    return fail("forbidden", "IA não dispara campanha.", 403, { requestId });
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("validation_failed", "Corpo inválido.", 422, { requestId });
  }
  const parsed = bodySchema.safeParse(corpo);
  if (!parsed.success) {
    return fail("validation_failed", "Pedido inválido.", 422, { requestId });
  }

  const r = reescreverRascunhoLocal(parsed.data.texto, parsed.data.acao);
  return ok({ ...r, enviou: false }, { requestId });
}
