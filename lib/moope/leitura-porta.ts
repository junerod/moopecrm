/**
 * Porta das leituras MOOPE.
 *
 * A organização sai da chave `mop_`, nunca de um usuário. O Facejus (ou a
 * locadora) guarda esse token e decide, nas permissões dele, quem pode ver
 * a tela. A pessoa logada lá não precisa existir aqui.
 */
import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { leituraAutorizada } from "@/lib/api-tokens/contrato";
import { fail, ok } from "@/lib/api/wrappers";
import { logger } from "@/lib/logger";
import { extrairBearer } from "@/lib/moope/chave";
import { resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export type LeituraAberta = {
  ok: true;
  requestId: string;
  admin: SupabaseClient;
  orgId: string;
};

/**
 * Duas chaves servem, e as duas identificam a organização, não a pessoa:
 * a chave mop_ da Integração MOOPE, ou um token dsk_ criado em Tokens de API
 * com a permissão de ler o CRM.
 */
export async function abrirLeitura(
  req: NextRequest,
): Promise<LeituraAberta | { ok: false; response: Response }> {
  const requestId = randomUUID();
  const admin = createAdminClient();
  const header = req.headers.get("authorization");
  const plaintext = extrairBearer(header);

  if (plaintext?.startsWith("dsk_")) {
    return abrirPeloToken(admin, plaintext, requestId);
  }

  const conexao = await resolverConexaoPeloBearer(admin, header);
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

async function abrirPeloToken(
  admin: SupabaseClient,
  plaintext: string,
  requestId: string,
): Promise<LeituraAberta | { ok: false; response: Response }> {
  const tokenHash = createHash("sha256").update(plaintext).digest();
  const { data, error } = await admin
    .from("api_tokens")
    .select("id, organization_id, scopes, revoked_at, expires_at")
    .eq("token_hash", `\\x${tokenHash.toString("hex")}`)
    .maybeSingle();

  if (error) {
    logger.warn("moope.leitura.token", { erro: error.message });
    return {
      ok: false,
      response: fail("internal_error", "Não consegui conferir o token.", 500, { requestId }),
    };
  }

  const julgamento = leituraAutorizada({
    encontrado: Boolean(data),
    scopes: data?.scopes,
    revokedAt: data?.revoked_at ?? null,
    expiresAt: data?.expires_at ?? null,
  });
  if (!julgamento.ok || !data) {
    const status = julgamento.ok ? 401 : julgamento.status;
    const message = julgamento.ok ? "Token não reconhecido." : julgamento.message;
    return {
      ok: false,
      response: fail(status === 403 ? "forbidden" : "unauthenticated", message, status, {
        requestId,
      }),
    };
  }

  void admin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .eq("organization_id", data.organization_id);

  return { ok: true, requestId, admin, orgId: data.organization_id };
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
