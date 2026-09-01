/**
 * GET /api/v1/integrations/moope/channel
 *
 * A locadora pergunta se o número está aquecendo, quantos cabem hoje e se
 * pode mandar agora. Bearer mop_… Só leitura. O /send continua sendo o freio.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { retratoDoCanalDaOrg } from "@/lib/moope/canal-do-parceiro";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  const conexao = await resolverConexaoPeloBearer(admin, req.headers.get("authorization"));
  if (!conexao) {
    return fail("unauthenticated", "Chave de integração inválida ou desligada.", 401, { requestId });
  }

  const retrato = await retratoDoCanalDaOrg(admin, conexao.organization_id);
  return ok(retrato, { requestId });
}
