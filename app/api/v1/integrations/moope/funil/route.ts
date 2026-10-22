/**
 * GET /api/v1/integrations/moope/funil
 *
 * Como o funil está: etapas, quantos negócios abertos, valor, ganhos e
 * perdidos. Só leitura. Não move card.
 */
import type { NextRequest } from "next/server";

import { funilDoParceiro } from "@/lib/moope/leitura-consultar";
import { abrirLeitura, ler } from "@/lib/moope/leitura-porta";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const aberto = await abrirLeitura(req);
  if (!aberto.ok) return aberto.response;
  return ler(aberto, () => funilDoParceiro(aberto.admin, aberto.orgId), {});
}
