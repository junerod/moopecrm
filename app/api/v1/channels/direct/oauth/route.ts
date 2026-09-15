/**
 * GET /api/v1/channels/direct/oauth — começa o consentimento da Meta.
 *
 * O navegador sai daqui para a Meta. Authenticator, se houver, é lá.
 * A volta é `/oauth/callback`.
 */
import { NextResponse, type NextRequest } from "next/server";

import { requireRole } from "@/lib/auth/require-role";
import {
  configuracaoDoAppMeta,
  emitirEstadoInstagram,
  montarUrlDeConsentimento,
  normalizarArrobaInstagram,
} from "@/lib/channels/direct";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function voltarComErro(codigo: string): NextResponse {
  const base = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(new URL(`/app/connections?aba=instagram&erro=${codigo}`, base));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = req.headers.get("x-request-id") ?? undefined;
  const autorizado = await requireRole("admin", { requestId, resource: "channel_sessions" });
  if (!autorizado.ok) return autorizado.response;

  const app = configuracaoDoAppMeta();
  if (!app) return voltarComErro("app_nao_configurado");

  const digitado = req.nextUrl.searchParams.get("conta");
  const contaEsperada = normalizarArrobaInstagram(digitado);
  if ((digitado ?? "").trim() && !contaEsperada) return voltarComErro("conta_invalida");

  const base = env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const redirectUri = `${base.replace(/\/$/, "")}/api/v1/channels/direct/oauth/callback`;

  let state: string;
  try {
    state = emitirEstadoInstagram(
      {
        organizationId: autorizado.org.orgId,
        userId: autorizado.user.id,
        contaEsperada,
      },
      { segredo: env.INTERNAL_SECRET, agora: new Date() },
    );
  } catch {
    return voltarComErro("segredo_indisponivel");
  }

  return NextResponse.redirect(montarUrlDeConsentimento({ app, redirectUri, state }));
}
