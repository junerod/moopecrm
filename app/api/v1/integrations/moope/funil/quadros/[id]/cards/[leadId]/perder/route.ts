/** POST .../cards/:leadId/perder — fecha como perdido, com motivo. */
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { perderCardSchema } from "@/lib/moope/funil-quadro";
import { perderCard } from "@/lib/moope/funil-quadro-consultar";
import { ehResposta, executar, idsDoQuadro } from "@/lib/moope/funil-rota";
import { abrirEscrita } from "@/lib/moope/leitura-porta";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; leadId: string }> },
): Promise<Response> {
  const aberto = await abrirEscrita(req);
  if (!aberto.ok) return aberto.response;
  const ids = idsDoQuadro(await ctx.params, aberto.requestId);
  if (ehResposta(ids) || !ids.leadId) {
    return ehResposta(ids) ? ids : fail("validation_failed", "Negócio inválido.", 422, { requestId: aberto.requestId });
  }
  const corpo = perderCardSchema.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return fail("validation_failed", corpo.error.issues[0]?.message ?? "Informe o motivo da perda.", 422, {
      requestId: aberto.requestId,
    });
  }
  const leadId = ids.leadId;
  return executar(
    aberto,
    () =>
      perderCard({
        db: aberto.admin,
        orgId: aberto.orgId,
        pipelineId: ids.pipelineId,
        leadId,
        lostReason: corpo.data.lost_reason,
        requestId: aberto.requestId,
      }),
    false,
  );
}
