/**
 * GET /api/v1/metrics/supervisao — KPIs de operação + comercial + campanhas.
 * Reusa getQueueStatus, fn_attendant_metrics, demandas e campaigns.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { ehPeriodoPronto, janelaDoPeriodo, type PeriodoPronto } from "@/lib/supervisao/periodo";
import { carregarKpisDeSupervisao } from "@/lib/supervisao/kpis";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "metrics" });
  if (!authz.ok) return authz.response;

  const raw = req.nextUrl.searchParams.get("periodo") ?? "30d";
  const periodo: PeriodoPronto = ehPeriodoPronto(raw) ? raw : "30d";
  const { from, to } = janelaDoPeriodo(periodo);

  const supabase = await createClient();
  try {
    const kpis = await carregarKpisDeSupervisao(supabase, {
      organizationId: authz.org.orgId,
      from,
      to,
    });
    return ok(
      {
        periodo,
        window: { from: from.toISOString(), to: to.toISOString() },
        ...kpis,
      },
      { requestId },
    );
  } catch (err) {
    return fail(
      "internal_error",
      err instanceof Error ? err.message : "Falha ao carregar supervisão.",
      500,
      { requestId },
    );
  }
}
