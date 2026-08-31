/**
 * GET/POST/PATCH /api/v1/integrations/moope — conexão da organização.
 *
 * Cookie + admin. Plaintext da chave e do segredo só na criação (ou rotação).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { env } from "@/lib/env";
import { gerarChaveDeEntrada, gerarSegredoDeSaida } from "@/lib/moope/chave";
import { MOOPE_KINDS } from "@/lib/moope/tipos";
import { encryptWebhookSecret } from "@/lib/webhooks/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COLS =
  "id, organization_id, kind, partner_webhook_url, inbound_key_prefix, status, created_at, updated_at";

const criarSchema = z.object({
  kind: z.enum(MOOPE_KINDS),
  partner_webhook_url: z.string().url().optional().or(z.literal("")),
});

const patchSchema = z.object({
  kind: z.enum(MOOPE_KINDS).optional(),
  partner_webhook_url: z.string().url().optional().or(z.literal("")).nullable(),
  status: z.enum(["active", "disabled"]).optional(),
  rotate_inbound: z.boolean().optional(),
  rotate_outbound: z.boolean().optional(),
});

function publico(row: Record<string, unknown>) {
  return {
    ...row,
    public_url: env.NEXT_PUBLIC_APP_URL,
  };
}

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "moope_connection" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("moope_connections")
    .select(COLS)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  return ok(data ? publico(data as Record<string, unknown>) : null, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "moope_connection" });
  if (!authz.ok) return authz.response;

  let body: z.infer<typeof criarSchema>;
  try {
    body = criarSchema.parse(await req.json());
  } catch (err) {
    return fail("validation_failed", err instanceof Error ? err.message : "body inválido", 422, {
      requestId,
    });
  }

  const admin = createAdminClient();
  const { data: ja } = await admin
    .from("moope_connections")
    .select("id")
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (ja) {
    return fail("state_conflict", "Esta organização já tem uma conexão MOOPE. Use PATCH.", 409, {
      requestId,
    });
  }

  const entrada = gerarChaveDeEntrada();
  const saida = gerarSegredoDeSaida();
  const enc = await encryptWebhookSecret(admin, saida);
  if (!enc) {
    return fail(
      "internal_error",
      "Cifra indisponível nesta instalação — o segredo de saída não foi gravado.",
      422,
      { requestId },
    );
  }

  const webhook =
    body.partner_webhook_url && body.partner_webhook_url.length > 0
      ? body.partner_webhook_url
      : null;

  const { data: created, error } = await admin
    .from("moope_connections")
    .insert({
      organization_id: authz.org.orgId,
      kind: body.kind,
      partner_webhook_url: webhook,
      inbound_key_prefix: entrada.prefix,
      inbound_key_hash: entrada.hash,
      outbound_secret_enc: enc,
      status: "active",
      created_by_user_id: authz.user.id,
    } as never)
    .select(COLS)
    .single();
  if (error || !created) {
    return fail("internal_error", error?.message ?? "falha ao criar", 500, { requestId });
  }

  await audit({
    action: "moope.connection_created",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "moope_connection",
    resourceId: (created as { id: string }).id,
    requestId,
    metadata: { kind: body.kind, prefix: entrada.prefix },
  });

  return ok(
    {
      ...publico(created as Record<string, unknown>),
      inbound_key: entrada.plaintext,
      outbound_secret: saida,
      _warning: "Salve a chave e o segredo agora — eles não serão mostrados novamente.",
    },
    { status: 201, requestId },
  );
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "moope_connection" });
  if (!authz.ok) return authz.response;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (err) {
    return fail("validation_failed", err instanceof Error ? err.message : "body inválido", 422, {
      requestId,
    });
  }

  const admin = createAdminClient();
  const { data: atual } = await admin
    .from("moope_connections")
    .select("id")
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!atual) return fail("not_found", "Não há conexão MOOPE nesta organização.", 404, { requestId });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.kind) patch.kind = body.kind;
  if (body.status) patch.status = body.status;
  if (body.partner_webhook_url !== undefined) {
    patch.partner_webhook_url =
      body.partner_webhook_url && body.partner_webhook_url.length > 0
        ? body.partner_webhook_url
        : null;
  }

  let inboundPlain: string | undefined;
  let outboundPlain: string | undefined;
  if (body.rotate_inbound) {
    const entrada = gerarChaveDeEntrada();
    patch.inbound_key_prefix = entrada.prefix;
    patch.inbound_key_hash = entrada.hash;
    inboundPlain = entrada.plaintext;
  }
  if (body.rotate_outbound) {
    const saida = gerarSegredoDeSaida();
    const enc = await encryptWebhookSecret(admin, saida);
    if (!enc) {
      return fail("internal_error", "Cifra indisponível — não rodei o segredo.", 422, { requestId });
    }
    patch.outbound_secret_enc = enc;
    outboundPlain = saida;
  }

  const { data: updated, error } = await admin
    .from("moope_connections")
    .update(patch as never)
    .eq("id", (atual as { id: string }).id)
    .eq("organization_id", authz.org.orgId)
    .select(COLS)
    .single();
  if (error || !updated) {
    return fail("internal_error", error?.message ?? "falha ao atualizar", 500, { requestId });
  }

  await audit({
    action: "moope.connection_updated",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "moope_connection",
    resourceId: (updated as { id: string }).id,
    requestId,
    metadata: {
      rotate_inbound: Boolean(body.rotate_inbound),
      rotate_outbound: Boolean(body.rotate_outbound),
    },
  });

  return ok(
    {
      ...publico(updated as Record<string, unknown>),
      ...(inboundPlain ? { inbound_key: inboundPlain } : {}),
      ...(outboundPlain ? { outbound_secret: outboundPlain } : {}),
    },
    { requestId },
  );
}
