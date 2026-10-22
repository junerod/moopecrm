/**
 * GET /api/v1/integrations/moope/pulso
 *
 * Indicadores do escritório. Só gestor ou admin. Só leitura.
 * Não devolve nome de atendente nem id de usuário.
 */
import type { NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { pulsoDoParceiro } from "@/lib/moope/leitura-consultar";
import { abrirLeitura, ler } from "@/lib/moope/leitura-porta";
import { ehPeriodoPronto } from "@/lib/supervisao/periodo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const aberto = await abrirLeitura(req);
  if (!aberto.ok) return aberto.response;

  if (!aberto.ator.gestor) {
    return fail(
      "forbidden",
      "O pulso do escritório só aparece para gestor ou admin no CRM.",
      403,
      { requestId: aberto.requestId },
    );
  }

  const bruto = req.nextUrl.searchParams.get("periodo") ?? "7d";
  if (!ehPeriodoPronto(bruto)) {
    return fail("validation_failed", "periodo é hoje, 7d ou 30d.", 422, {
      requestId: aberto.requestId,
    });
  }

  return ler(aberto, () => pulsoDoParceiro(aberto.admin, aberto.orgId, bruto), { periodo: bruto });
}
