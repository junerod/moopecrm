/**
 * GET /api/v1/channels/direct/oauth/callback — a volta do consentimento.
 *
 * Troca o código pela conta profissional, cifra o token e grava a sessão.
 * Todo desfecho volta para Conexões › Instagram, nunca JSON.
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { loadAuthUser } from "@/lib/auth/server";
import {
  configuracaoDoAppMeta,
  gravarSessaoDirect,
  trocarCodigoPorConta,
  verificarEstadoInstagram,
} from "@/lib/channels/direct";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function voltar(qs: string): NextResponse {
  const base = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(new URL(`/app/connections?aba=instagram&${qs}`, base));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const params = req.nextUrl.searchParams;

  if (params.get("error") || params.get("error_reason") === "user_denied") {
    return voltar("erro=cancelado");
  }

  const app = configuracaoDoAppMeta();
  if (!app) return voltar("erro=app_nao_configurado");

  let estado;
  try {
    estado = verificarEstadoInstagram(params.get("state"), {
      segredo: env.INTERNAL_SECRET,
      agora: new Date(),
    });
  } catch {
    return voltar("erro=segredo_indisponivel");
  }
  if (!estado) return voltar("erro=state_invalido");

  const user = await loadAuthUser();
  if (!user || user.id !== estado.userId) return voltar("erro=sessao");

  const code = params.get("code")?.trim() ?? "";
  if (!code) return voltar("erro=codigo_ausente");

  const base = env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const redirectUri = `${base.replace(/\/$/, "")}/api/v1/channels/direct/oauth/callback`;

  const conta = await trocarCodigoPorConta({ app, code, redirectUri });
  if ("erro" in conta) {
    return voltar(
      `erro=${conta.erro === "instagram_sem_pagina" ? "instagram_sem_pagina" : "troca_falhou"}`,
    );
  }

  const gravado = await gravarSessaoDirect(createAdminClient(), {
    organizationId: estado.organizationId,
    accountId: conta.accountId,
    username: conta.username,
    token: conta.token,
    userId: estado.userId,
    requestId,
  });
  if (gravado.error) return voltar("erro=gravar");

  await audit({
    action: "channel.connected",
    organizationId: estado.organizationId,
    actorUserId: estado.userId,
    requestId,
    metadata: { provider: "instagram", ok: true, via: "oauth" },
  });

  return voltar("ok=1");
}
