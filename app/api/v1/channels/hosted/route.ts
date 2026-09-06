/**
 * GET  /api/v1/channels/hosted — estado da conexão hospedada.
 * POST /api/v1/channels/hosted — valida SID + token + número e grava.
 *
 * O caminho não cita o provedor. Quem valida e quais colunas gravar
 * estão em `lib/channels/hosted`.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  HOSTED_CHANNEL_LABEL,
  findHostedSession,
  saveHostedSession,
  hostedFromDigits,
  validateHostedCredentials,
} from "@/lib/channels/hosted";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptWebhookSecret } from "@/lib/webhooks/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const conectarSchema = z.object({
  account_sid: z.string().trim().min(8).max(64),
  auth_token: z.string().trim().min(8).max(500),
  from_number: z.string().trim().min(8).max(32),
});

type Gate = { ok: true; orgId: string; userId: string } | { ok: false; resposta: NextResponse };

async function adminGate(requestId: string): Promise<Gate> {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org || ROLE_RANK[org.role] < ROLE_RANK.admin) {
    return { ok: false, resposta: fail("forbidden", "admin_required", 403, { requestId }) };
  }
  return { ok: true, orgId: org.orgId, userId: user.id };
}

function urlDoWebhook(req: NextRequest, token: string): string {
  const configurada = env.NEXT_PUBLIC_APP_URL;
  const usavel = configurada && !configurada.includes("placeholder.invalid") ? configurada : null;
  const base = (
    usavel ??
    req.headers.get("origin") ??
    `${req.nextUrl.protocol}//${req.nextUrl.host}`
  ).replace(/\/+$/, "");
  return `${base}/api/v1/webhooks/channel/${token}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const g = await adminGate(requestId);
  if (!g.ok) return g.resposta;

  const sessao = await findHostedSession(createAdminClient(), g.orgId);
  const conectado = !!sessao && !sessao.archivedAt;

  return ok(
    {
      label: HOSTED_CHANNEL_LABEL,
      connected: conectado,
      phone_number: conectado ? sessao.phoneNumber : null,
      display_name: conectado ? sessao.displayName : null,
      status: conectado ? sessao.status : null,
      has_token: conectado ? sessao.hasToken : false,
      webhook_url:
        conectado && sessao.webhookPathToken ? urlDoWebhook(req, sessao.webhookPathToken) : null,
    },
    { requestId },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();
  const g = await adminGate(requestId);
  if (!g.ok) return g.resposta;

  const parsed = conectarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("invalid_request", "account_sid, auth_token e from_number são obrigatórios", 422, {
      requestId,
    });
  }

  const v = await validateHostedCredentials({
    accountSid: parsed.data.account_sid,
    authToken: parsed.data.auth_token,
    fromNumber: parsed.data.from_number,
  });
  if (!v.ok) return fail("invalid_request", v.reason, 422, { requestId });

  const admin = createAdminClient();
  const tokenCifrado = await encryptWebhookSecret(admin, parsed.data.auth_token);
  const segredoWebhook = randomBytes(32).toString("hex");
  const segredoCifrado = await encryptWebhookSecret(admin, segredoWebhook);
  if (!tokenCifrado || !segredoCifrado) {
    return fail(
      "invalid_request",
      "cifra indisponível nesta instalação — a chave não foi gravada",
      422,
      { requestId },
    );
  }

  const existente = await findHostedSession(admin, g.orgId);
  const token = existente?.webhookPathToken ?? randomBytes(16).toString("hex");
  const fromDigits = hostedFromDigits(parsed.data.from_number);

  const { error } = await saveHostedSession(admin, {
    organizationId: g.orgId,
    existingId: existente?.id ?? null,
    fromDigits,
    accountSid: parsed.data.account_sid.trim(),
    tokenEncrypted: tokenCifrado,
    webhookPathToken: token,
    webhookSecretEncrypted: segredoCifrado,
    phoneNumber: v.phoneNumber,
    displayName: v.displayName,
  });
  if (error) return fail("internal_error", error, 500, { requestId });

  const gravada = await findHostedSession(admin, g.orgId);
  void audit({
    action: "channel.connected",
    actorUserId: g.userId,
    organizationId: g.orgId,
    resourceType: "channel_session",
    resourceId: gravada?.id ?? existente?.id ?? undefined,
    requestId,
    metadata: { reconectou: Boolean(existente) },
  });

  return ok(
    {
      connected: true,
      phone_number: v.phoneNumber,
      display_name: v.displayName,
      webhook_url: urlDoWebhook(req, token),
    },
    { requestId },
  );
}
