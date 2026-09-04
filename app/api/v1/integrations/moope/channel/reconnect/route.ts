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
    const status = out.motivo === "precisa_qr" ? 409 : out.motivo === "sem_canal" ? 404 : 502;
    return fail("channel_reconnect_failed", out.error, status, { requestId });
  }
  return ok({ status: out.status, skipped: out.skipped || null }, { requestId });
}
