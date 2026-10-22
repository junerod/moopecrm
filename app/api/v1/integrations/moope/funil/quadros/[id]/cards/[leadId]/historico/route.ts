/** GET .../cards/:leadId/historico — a timeline do dossiê, sem id de usuário. */
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { historicoDoCard } from "@/lib/moope/funil-quadro-consultar";
import { ehResposta, executar, idsDoQuadro } from "@/lib/moope/funil-rota";
import { abrirLeitura } from "@/lib/moope/leitura-porta";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; leadId: string }> },
): Promise<Response> {
  const aberto = await abrirLeitura(req);
  if (!aberto.ok) return aberto.response;
  const ids = idsDoQuadro(await ctx.params, aberto.requestId);
  if (ehResposta(ids) || !ids.leadId) {
    return ehResposta(ids) ? ids : fail("validation_failed", "Negócio inválido.", 422, { requestId: aberto.requestId });
  }
  const leadId = ids.leadId;
  return executar(
    aberto,
    () => historicoDoCard(aberto.admin, aberto.orgId, ids.pipelineId, leadId),
    true,
  );
}
