/**
 * Porta das leituras MOOPE. A org sai da chave. A pessoa sai do e-mail,
 * e só se esse e-mail já for membro. Sem isso um token de máquina lia a
 * pauta de todo mundo.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { logger } from "@/lib/logger";
import { emailEMembro, resolverConexaoPeloBearer } from "@/lib/moope/auth";
import { ehGestorDaLeitura, papelDaLeitura, type PapelDaLeitura } from "@/lib/moope/leitura";
import { createAdminClient } from "@/lib/supabase/admin";

const emailSchema = z.string().email().max(320);

export interface AtorDaLeitura {
  userId: string;
  email: string;
  papel: PapelDaLeitura;
  gestor: boolean;
}

export type LeituraAberta = {
  ok: true;
  requestId: string;
  admin: SupabaseClient;
  orgId: string;
  ator: AtorDaLeitura;
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

  const bruto = req.nextUrl.searchParams.get("actor_email") ?? "";
  const email = emailSchema.safeParse(bruto.trim().toLowerCase());
  if (!email.success) {
    return {
      ok: false,
      response: fail(
        "validation_failed",
        "Informe actor_email com o e-mail de quem está logado no outro sistema.",
        422,
        { requestId },
      ),
    };
  }

  const membro = await emailEMembro(admin, conexao.organization_id, email.data);
  if (!membro) {
    return { ok: false, response: convite(requestId) };
  }

  const { data: linha } = await admin
    .from("user_organizations")
    .select("role")
    .eq("user_id", membro.userId)
    .eq("organization_id", conexao.organization_id)
    .is("revoked_at", null)
    .maybeSingle();

  const papel = papelDaLeitura(linha?.role);
  if (!papel) return { ok: false, response: convite(requestId) };

  return {
    ok: true,
    requestId,
    admin,
    orgId: conexao.organization_id,
    ator: {
      userId: membro.userId,
      email: membro.email,
      papel,
      gestor: ehGestorDaLeitura(papel),
    },
  };
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
      meta: { read_only: true, scope: aberto.ator.gestor ? "office" : "mine", ...meta },
    });
  } catch (err) {
    logger.warn("moope.leitura", {
      erro: err instanceof Error ? err.message : "falha",
    });
    return fail("internal_error", "Não consegui ler agora.", 500, { requestId: aberto.requestId });
  }
}

function convite(requestId: string): Response {
  return fail(
    "forbidden",
    "Use o mesmo e-mail nos dois sistemas e peça para o admin do CRM te convidar.",
    403,
    { requestId },
  );
}
