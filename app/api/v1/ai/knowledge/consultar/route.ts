/**
 * POST /api/v1/ai/knowledge/consultar — testa o conhecimento da empresa.
 *
 * organization_id NUNCA vem do body. A pergunta é o único input.
 * Usa o mesmo retrieval do Copilot (`recuperarConhecimentoDaEmpresa`).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { recuperarConhecimentoDaEmpresa } from "@/lib/ai/copiloto/recuperar";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  pergunta: z.string().trim().min(3).max(500),
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
    return fail("validation_failed", "Escreva uma pergunta.", 422, { requestId });
  }

  try {
    const rec = await recuperarConhecimentoDaEmpresa(
      await createClient(),
      authz.org.orgId,
      parsed.data.pergunta,
    );
    return ok(
      {
        encontrou: rec.trechos.length > 0,
        origem: rec.origem,
        trechos: rec.trechos.map((t) => ({
          texto: t.content,
          fonte: t.fonte,
        })),
      },
      { requestId },
    );
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Não consegui consultar o conhecimento.",
      500,
      { requestId },
    );
  }
}
