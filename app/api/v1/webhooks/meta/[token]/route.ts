/**
 * GET|POST /api/v1/webhooks/meta/[token] — webhook da WhatsApp Cloud API.
 *
 * `GET` é o handshake de verificação: a Meta só começa a entregar eventos depois
 * que o endpoint devolve `hub.challenge` **em texto puro**. Envelopar em
 * `{data:...}` (o wrapper padrão da nossa API) faz a verificação falhar com uma
 * mensagem inútil no dashboard — por isso esta é a única rota do repo que
 * responde texto cru, e está aqui escrito o motivo.
 *
 * `POST` verifica HMAC **SHA-256** com o App Secret, e só então age. O outro canal
 * do repo usa SHA-512 com segredo por sessão — não reaproveite a verificação dele;
 * o detalhe está em `lib/channels/meta/webhook.ts`.
 *
 * Por que ainda existe token no path se o App Secret é global: o segredo é do APP,
 * e um app serve N WABAs de N organizações. O token amarra o payload a UMA org
 * antes de qualquer escrita — sem ele, quem conhecesse o App Secret escreveria em
 * qualquer tenant.
 */
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { fail } from "@/lib/api/wrappers";
import { processarWebhookDoAppMeta } from "@/lib/channels/meta/despacho";
import { lerEnvelopeMeta } from "@/lib/channels/meta/envelope";
import { metaSessionByWebhookToken } from "@/lib/channels/meta/session";
import { verificationChallenge, verifyMetaSignature } from "@/lib/channels/meta/webhook";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface RouteCtx {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const { token } = await ctx.params;
  const session = await metaSessionByWebhookToken(token);
  if (!session) return new NextResponse("not found", { status: 404 });

  const challenge = verificationChallenge(
    req.nextUrl.searchParams,
    process.env.META_WEBHOOK_VERIFY_TOKEN ?? "",
  );
  if (challenge === null) return new NextResponse("forbidden", { status: 403 });

  // Texto puro, sem wrapper — ver o cabeçalho.
  return new NextResponse(challenge, {
    status: 200,
    headers: { "content-type": "text/plain" },
  });
}

export async function POST(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const requestId = randomUUID();
  const { token } = await ctx.params;

  const session = await metaSessionByWebhookToken(token);
  if (!session) return fail("not_found", "unknown webhook token", 404, { requestId });

  const rawBody = await req.text();
  const appSecret = process.env.META_APP_SECRET ?? "";
  if (!verifyMetaSignature(rawBody, req.headers.get("x-hub-signature-256"), appSecret)) {
    return fail("unauthorized", "invalid_signature", 401, { requestId });
  }

  // ─── O contrato do fio, ANTES do parser ───────────────────────────────────
  //
  // Isto era `JSON.parse(rawBody)` seguido de um `as`: cast, que não confere
  // nada em execução. `parseMetaWebhook` então faz `for (const entry of
  // envelope.entry ?? [])` — e `for...of` sobre um número LANÇA. Não há
  // try/catch em volta: a exceção subia sem ninguém tratá-la (o framework
  // responde 5xx) e a Meta reentregava em backoff um corpo que nunca melhora.
  //
  // 400 e não 200: o 200 generoso desta rota existe para EVENTO QUE NÃO NOS
  // INTERESSA (a Meta reentrega o que não recebe 2xx), e um payload fora do
  // contrato não é isso — é o fio ter mudado, que ninguém pode descobrir tarde.
  // O schema é loose e todo campo é opcional, então chegar aqui exige um campo
  // que a gente LÊ vir com o tipo errado. Ver lib/channels/meta/envelope.ts.
  const leitura = lerEnvelopeMeta(rawBody);
  if (!leitura.ok) {
    if (leitura.motivo === "json_invalido") {
      return fail("invalid_request", "invalid_json", 400, { requestId });
    }
    logger.error("[meta.webhook] payload fora do contrato do canal", {
      request_id: requestId,
      campos: leitura.campos,
    });
    return fail("validation_failed", "payload fora do contrato do canal", 400, {
      requestId,
      details: { campos: leitura.campos },
    });
  }

  const admin = createAdminClient();
  const desfechos = await processarWebhookDoAppMeta(admin, leitura.envelope, session);

  // 200 SEMPRE que a assinatura confere, inclusive para evento que não nos
  // interessa: a Meta re-entrega tudo que não recebe 2xx, e recusar o que
  // ignoramos vira re-tentativa em backoff por horas.
  // `outcomes` no corpo: quem depura vê o que aconteceu com cada evento em vez de
  // ler um contador que não distingue sucesso de falha.
  return NextResponse.json(
    { received: desfechos.length, outcomes: desfechos },
    { status: 200 },
  );
}
