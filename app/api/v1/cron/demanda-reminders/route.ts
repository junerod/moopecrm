/**
 * GET/POST /api/v1/cron/demanda-reminders
 *
 * Alerta INTERNO ao atendente sobre próxima ação. Mock nesta rodada:
 * não chama WAHA, não cria conversation/message, não muda owner/AI_MODE.
 *
 * Audita só quando houve entrega (doutrina: cron vazio não ocupa audit).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { varrerAlertasDeProximasAcoes } from "@/lib/comercial/disparar-alertas";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const accepted = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  if (accepted.length === 0 || !provided || !accepted.includes(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  try {
    const resultado = await varrerAlertasDeProximasAcoes(createAdminClient());
    if (resultado.enviados > 0) {
      void audit({
        action: "demanda.alertas_enviados",
        requestId,
        bypassedRls: true,
        metadata: {
          enviados: resultado.enviados,
          pulados: resultado.pulados,
          via: "mock",
        },
      });
    }
    return ok(
      {
        enviados: resultado.enviados,
        pulados: resultado.pulados,
        entregas: resultado.entregas.map((e) => ({
          classificacao: e.classificacao,
          dest_e164: e.dest_e164,
          demanda_id: e.demanda_id,
          kind: e.kind,
          via: e.via,
        })),
      },
      { requestId },
    );
  } catch (err) {
    logger.error("[demanda-reminders] falhou", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("internal_error", "Failed to scan reminders.", 500, { requestId });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
