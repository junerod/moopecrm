/**
 * Porta das leituras MOOPE.
 *
 * A organização sai da chave `mop_`, nunca de um usuário. O Facejus (ou a
 * locadora) guarda esse token e decide, nas permissões dele, quem pode ver
 * a tela. A pessoa logada lá não precisa existir aqui.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fail, ok } from "@/lib/api/wrappers";
import { logger } from "@/lib/logger";
import { resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type LeituraAberta = {
  ok: true;
  requestId: string;
  admin: SupabaseClient;
  orgId: string;
};

export async function abrirLeitura(
  req: NextRequest,
): Promise<LeituraAberta | { ok: false; response: Response }> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  const conexao = await resolverConexaoPeloBearer(admin, req.headers.get("authorization"));
  if (!conexao) {
    return {
      ok: false,
      response: fail("unauthenticated", "Chave de integração inválida ou desligada.", 401, {
        requestId,
      }),
    };
  }

  return { ok: true, requestId, admin, orgId: conexao.organization_id };
}

export async function ler(
  aberto: LeituraAberta,
  fn: () => Promise<unknown>,
  meta: Record<string, unknown>,
): Promise<Response> {
  try {
    const data = await fn();
    return ok(data, {
      requestId: aberto.requestId,
      meta: { read_only: true, scope: "office", ...meta },
    });
  } catch (err) {
    logger.warn("moope.leitura", {
      erro: err instanceof Error ? err.message : "falha",
    });
    return fail("internal_error", "Não consegui ler agora.", 500, { requestId: aberto.requestId });
  }
}
