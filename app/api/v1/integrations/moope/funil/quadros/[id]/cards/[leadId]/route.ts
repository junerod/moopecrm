/**
 * PATCH /api/v1/integrations/moope/funil/quadros/:id/cards/:leadId
 *
 * Título, valor ou temperatura. A mesma linha que a ficha do CRM edita.
 */
import type { NextRequest } from "next/server";

import { editarCardSchema } from "@/lib/moope/funil-quadro";
import { editarCard } from "@/lib/moope/funil-quadro-consultar";
import { ehResposta, executar, idsDoQuadro } from "@/lib/moope/funil-rota";
import { abrirEscrita } from "@/lib/moope/leitura-porta";
import { fail } from "@/lib/api/wrappers";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; leadId: string }> },
): Promise<Response> {
  const aberto = await abrirEscrita(req);
  if (!aberto.ok) return aberto.response;
  if (!aberto.tokenId) {
    return fail("forbidden", "Token ausente.", 403, { requestId: aberto.requestId });
  }
  const ids = idsDoQuadro(await ctx.params, aberto.requestId);
  if (ehResposta(ids) || !ids.leadId) return ehResposta(ids) ? ids : fail("validation_failed", "Negócio inválido.", 422, { requestId: aberto.requestId });
  const corpo = editarCardSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", corpo.error.issues[0]?.message ?? "Corpo inválido.", 422, {
      requestId: aberto.requestId,
    });
  }
  const leadId = ids.leadId;
  return executar(
    aberto,
    () =>
      editarCard({
        db: aberto.admin,
        orgId: aberto.orgId,
        pipelineId: ids.pipelineId,
        leadId,
        expectedUpdatedAt: corpo.data.expected_updated_at,
        title: corpo.data.title,
        valueCents: corpo.data.value_cents,
        temperature: corpo.data.temperature,
        requestId: aberto.requestId,
        tokenId: aberto.tokenId as string,
      }),
    false,
  );
}
