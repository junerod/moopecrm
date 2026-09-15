/**
 * GET/POST /api/v1/cron/direct-sync — puxa o Direct que a Graph já vê.
 *
 * O webhook da Meta falha em silêncio (app em desenvolvimento, testador).
 * Sem esta rodada a Inbox só enche se alguém clicar em Buscar.
 *
 * Auth: Bearer INTERNAL_CRON_SECRET|INTERNAL_SECRET (fail-closed).
 * Agendada no scheduler a cada 5 min.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { sincronizarDirectDeTodasAsOrgs } from "@/lib/channels/direct";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const accepted = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  if (accepted.length === 0 || !provided || !accepted.includes(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  try {
    const resumo = await sincronizarDirectDeTodasAsOrgs(createAdminClient());
    if (resumo.imported > 0 || resumo.erros > 0) {
      void audit({
        action: "channel.historico_importado",
        organizationId: null,
        bypassedRls: true,
        resourceType: "channel_session",
        metadata: { ...resumo, cron: true, face: "direct" },
        requestId,
      });
    }
    return ok(resumo, { requestId });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown";
    logger.error("[direct-sync.cron] falhou", { detail, requestId });
    return fail("cron_failed", detail, 500, { requestId });
  }
}

export const GET = handle;
export const POST = handle;
