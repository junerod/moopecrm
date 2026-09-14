/**
 * POST /api/v1/campanhas/segmento — estimativa + preview paginado.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { carregarContatosDoSegmento } from "@/lib/campanhas/carregar-contatos";
import { estimarSegmento, rotuloDaEstimativa } from "@/lib/campanhas/segmento";
import { segmentoSchema } from "@/lib/campanhas/schema";
import { SELECAO_DE_CANAIS } from "@/lib/campanhas/tipos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = segmentoSchema.and(
  z.object({
    channels: z.enum(SELECAO_DE_CANAIS).optional(),
    preview_offset: z.number().int().min(0).max(5000).optional(),
    preview_limit: z.number().int().min(1).max(50).optional(),
    q: z.string().max(80).optional(),
  }),
);

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
    const { channels, preview_offset, preview_limit, q, ...segmento } = parsed.data;
    const contatos = await carregarContatosDoSegmento(supabase, authz.org.orgId, segmento);
    const { count: totalBase } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", authz.org.orgId)
      .is("is_merged_into", null)
      .eq("is_anonymized", false);
    const est = estimarSegmento(contatos, segmento, channels ?? "whatsapp", totalBase ?? undefined);
    const offset = preview_offset ?? 0;
    const limit = preview_limit ?? 20;
    const busca = (q ?? "").trim().toLowerCase();
    const doPreview = contatos.filter((c) => {
      if (!est.ids.includes(c.id)) return false;
      if (!busca) return true;
      const nome = `${c.display_name ?? ""} ${c.name ?? ""} ${c.phone_number ?? ""} ${c.email ?? ""}`.toLowerCase();
      return nome.includes(busca);
    });
    const preview = doPreview.slice(offset, offset + limit).map((c) => ({
      id: c.id,
      nome: c.display_name || c.name || "Sem nome",
      telefone: c.phone_number ?? null,
      email: c.email ?? null,
      papel: c.papel ?? null,
      tem_whatsapp: Boolean(c.phone_number),
      tem_email: Boolean(c.email),
    }));
    return ok(
      {
        selecionados: est.selecionados,
        elegiveis: est.elegiveis,
        excluidos: est.excluidos,
        destinos: est.destinos,
        exclusoes: est.exclusoes,
        alcance: est.alcance,
        atinge_base_inteira: est.atinge_base_inteira,
        rotulo: rotuloDaEstimativa(est),
        preview,
        preview_offset: offset,
        preview_has_more: offset + limit < doPreview.length,
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
