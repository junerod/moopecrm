/**
 * POST /api/v1/campanhas/segmento — estimativa ("N contatos selecionados").
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { carregarContatosDoSegmento } from "@/lib/campanhas/carregar-contatos";
import { estimarSegmento } from "@/lib/campanhas/segmento";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  papel: z.string().max(40).nullable().optional(),
  origem: z.string().max(40).nullable().optional(),
  owner_user_id: z.string().uuid().nullable().optional(),
  pipeline_id: z.string().uuid().nullable().optional(),
  stage_id: z.string().uuid().nullable().optional(),
  temperatura: z.enum(["frio", "morno", "quente"]).nullable().optional(),
  contact_ids: z.array(z.string().uuid()).max(2000).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return fail("validation_failed", "Corpo inválido.", 422, { requestId });
  }
  const parsed = bodySchema.safeParse(corpo);
  if (!parsed.success) {
    return fail("validation_failed", "Segmento inválido.", 422, { requestId });
  }

  const supabase = await createClient();
  try {
    const contatos = await carregarContatosDoSegmento(supabase, authz.org.orgId, parsed.data);
    const est = estimarSegmento(contatos, parsed.data);
    return ok(
      {
        selecionados: est.selecionados,
        elegiveis: est.elegiveis,
        excluidos: est.excluidos,
        rotulo: `${est.elegiveis} contatos selecionados`,
      },
      { requestId },
    );
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Falha ao estimar segmento.",
      500,
      { requestId },
    );
  }
}
