/**
 * GET/POST /api/v1/cron/campaign-dispatch
 *
 * Worker de campanha comercial. Mock nesta rodada: sem WAHA, sem QR.
 * Audita só quando houve efeito.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { processarTickDasCampanhas } from "@/lib/campanhas/worker";
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
    const resultado = await processarTickDasCampanhas(createAdminClient());
    const efeito = resultado.enviados + resultado.pulados + resultado.falharam;
    if (efeito > 0) {
      void audit({
        action: "campaign.dispatch_tick",
        requestId,
        bypassedRls: true,
        metadata: {
          enviados: resultado.enviados,
          pulados: resultado.pulados,
          falharam: resultado.falharam,
          processadas: resultado.processadas,
          via: "mock",
        },
      });
    }
    return ok(
      {
        enviados: resultado.enviados,
        pulados: resultado.pulados,
        falharam: resultado.falharam,
        processadas: resultado.processadas,
        entregas: resultado.entregas,
      },
      { requestId },
    );
  } catch (err) {
    logger.error("[campaign-dispatch] falhou", {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
    return fail("internal_error", "Failed to dispatch campaigns.", 500, { requestId });
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}
