/**
 * GET /api/v1/integrations/moope/funil/quadros
 *
 * Os funis pelo nome. O quadro em si é o GET do id.
 */
import type { NextRequest } from "next/server";

import { listarQuadros } from "@/lib/moope/funil-quadro-consultar";
import { executar } from "@/lib/moope/funil-rota";
import { abrirLeitura } from "@/lib/moope/leitura-porta";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const aberto = await abrirLeitura(req);
  if (!aberto.ok) return aberto.response;
  return executar(aberto, () => listarQuadros(aberto.admin, aberto.orgId), true);
}
