/**
 * GET /api/v1/integrations/moope/funil/quadros/:id
 *
 * O quadro como a tela do CRM: etapas, inclusive ganho e perdido, e os cards
 * na posição. Não inclui telefone nem texto de WhatsApp.
 */
import type { NextRequest } from "next/server";

import { quadroDoFunil } from "@/lib/moope/funil-quadro-consultar";
import { ehResposta, executar, idsDoQuadro } from "@/lib/moope/funil-rota";
import { abrirLeitura } from "@/lib/moope/leitura-porta";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const aberto = await abrirLeitura(req);
  if (!aberto.ok) return aberto.response;
  const ids = idsDoQuadro(await ctx.params, aberto.requestId);
  if (ehResposta(ids)) return ids;
  return executar(
    aberto,
    async () => {
      const quadro = await quadroDoFunil(aberto.admin, aberto.orgId, ids.pipelineId);
      return quadro.ok ? quadro.data : quadro;
    },
    true,
  );
}
