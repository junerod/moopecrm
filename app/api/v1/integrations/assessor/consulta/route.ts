/**
 * POST /api/v1/integrations/assessor/consulta
 * O Assessor pergunta leads do dia, da semana, abertos ou quem falou hoje.
 */
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { consultarCrm } from "@/lib/assessor/consulta";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  phone: z.string().min(8).max(24),
  consulta: z.enum(["dia", "semana", "abertos", "respostas"]),
});

function segredoConfere(got: string | null): boolean {
  const expected = env.ASSESSOR_PARTNER_SECRET.trim();
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  if (!segredoConfere(req.headers.get("x-assessor-moope-secret"))) {
    return fail("unauthenticated", "Segredo do Assessor inválido.", 401, { requestId });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (err) {
    return fail("validation_failed", err instanceof Error ? err.message : "body inválido", 422, {
      requestId,
    });
  }
  try {
    const resultado = await consultarCrm(createAdminClient(), body.phone, body.consulta);
    if (!resultado) {
      return fail("not_found", "Esse número não está cadastrado no CRM.", 404, { requestId });
    }
    return ok(resultado, { requestId });
  } catch {
    return fail("internal", "Não consegui ler os leads.", 500, { requestId });
  }
}
