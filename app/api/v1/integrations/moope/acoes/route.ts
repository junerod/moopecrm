/**
 * GET /api/v1/integrations/moope/acoes
 *
 * Obrigações comerciais: hoje, próximas ou atrasadas. Só leitura.
 */
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { acoesDoParceiro } from "@/lib/moope/leitura-consultar";
import { abrirLeitura, ler } from "@/lib/moope/leitura-porta";

export const dynamic = "force-dynamic";

const VISOES = ["hoje", "proximos", "atrasados"] as const;

export async function GET(req: NextRequest): Promise<Response> {
  const aberto = await abrirLeitura(req);
  if (!aberto.ok) return aberto.response;

  const bruto = req.nextUrl.searchParams.get("visao") ?? "hoje";
  if (!VISOES.includes(bruto as (typeof VISOES)[number])) {
    return fail("validation_failed", "visao é hoje, proximos ou atrasados.", 422, {
      requestId: aberto.requestId,
    });
  }
  const visao = bruto as (typeof VISOES)[number];

  return ler(
    aberto,
    () => acoesDoParceiro(aberto.admin, aberto.orgId, aberto.ator, visao),
    { visao },
  );
}
