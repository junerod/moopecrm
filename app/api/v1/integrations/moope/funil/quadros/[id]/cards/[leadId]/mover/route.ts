/**
 * POST .../cards/:leadId/mover
 *
 * Arrastar o card. A posição é a do meio entre os vizinhos, como no quadro.
 * Sem position_in_stage, o card vai para o fim da etapa.
 */
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { moverCardSchema } from "@/lib/moope/funil-quadro";
import { moverCard } from "@/lib/moope/funil-quadro-consultar";
import { ehResposta, executar, idsDoQuadro } from "@/lib/moope/funil-rota";
import { abrirEscrita } from "@/lib/moope/leitura-porta";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; leadId: string }> },
): Promise<Response> {
  const aberto = await abrirEscrita(req);
  if (!aberto.ok) return aberto.response;
  if (!aberto.tokenId) {
    return fail("forbidden", "Token ausente.", 403, { requestId: aberto.requestId });
  }
  const ids = idsDoQuadro(await ctx.params, aberto.requestId);
  if (ehResposta(ids) || !ids.leadId) {
    return ehResposta(ids) ? ids : fail("validation_failed", "Negócio inválido.", 422, { requestId: aberto.requestId });
  }
  const corpo = moverCardSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", corpo.error.issues[0]?.message ?? "Corpo inválido.", 422, {
      requestId: aberto.requestId,
    });
  }
  const leadId = ids.leadId;
  return executar(
    aberto,
    () =>
      moverCard({
        db: aberto.admin,
        orgId: aberto.orgId,
        pipelineId: ids.pipelineId,
        leadId,
        stageId: corpo.data.stage_id,
        expectedUpdatedAt: corpo.data.expected_updated_at,
        positionInStage: corpo.data.position_in_stage,
        requestId: aberto.requestId,
        tokenId: aberto.tokenId as string,
      }),
    false,
  );
}
