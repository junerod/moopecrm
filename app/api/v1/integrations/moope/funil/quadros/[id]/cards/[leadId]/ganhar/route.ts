/** POST .../cards/:leadId/ganhar — fecha como ganho, na coluna de ganho do funil. */
import type { NextRequest } from "next/server";

import { ganharCard } from "@/lib/moope/funil-quadro-consultar";
import { ehResposta, executar, idsDoQuadro } from "@/lib/moope/funil-rota";
import { abrirEscrita } from "@/lib/moope/leitura-porta";
import { fail } from "@/lib/api/wrappers";

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
  const leadId = ids.leadId;
  return executar(
    aberto,
    () =>
      ganharCard({
        db: aberto.admin,
        orgId: aberto.orgId,
        pipelineId: ids.pipelineId,
        leadId,
        requestId: aberto.requestId,
      }),
    false,
  );
}
