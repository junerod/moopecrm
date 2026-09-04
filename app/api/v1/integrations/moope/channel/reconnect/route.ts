/**
 * POST /api/v1/integrations/moope/channel/reconnect
 * Locadora pede religar suave (STOPPED). Sem logout. Sem QR automático.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { reconectarCanalDoParceiro } from "@/lib/moope/reconectar-parceiro";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  const conexao = await resolverConexaoPeloBearer(admin, req.headers.get("authorization"));
  if (!conexao) {
    return fail("unauthenticated", "Chave de integração inválida ou desligada.", 401, { requestId });
  }

  const out = await reconectarCanalDoParceiro(admin, conexao.organization_id);
  if (!out.ok) {
    const status =
      out.motivo === "espera_pareamento" || out.motivo === "precisa_qr"
        ? 409
        : out.motivo === "sem_canal"
          ? 404
          : 502;
    const code = out.motivo === "espera_pareamento" ? "channel_pairing_wait" : "channel_reconnect_failed";
    return fail(code, out.error, status, {
      requestId,
      details: out.retry_after != null ? { retry_after: out.retry_after } : undefined,
      headers: out.retry_after != null ? { "Retry-After": String(out.retry_after) } : undefined,
    });
  }
  return ok({ status: out.status, skipped: out.skipped || null }, { requestId });
}
