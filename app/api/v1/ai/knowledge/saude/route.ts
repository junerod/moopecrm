/**
 * GET /api/v1/ai/knowledge/saude
 *
 * Diagnóstico técnico sem secret: storage, embedding, OCR, Vision.
 */
import { randomUUID } from "node:crypto";

import { saudeDoConhecimento } from "@/lib/ai/knowledge/saude";
import { ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ai_knowledge" });
  if (!authz.ok) return authz.response;
  return ok(saudeDoConhecimento(), { requestId });
}
