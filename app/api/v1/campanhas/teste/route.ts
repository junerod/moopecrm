/**
 * POST /api/v1/campanhas/teste — manda a mensagem (e a mídia) para UM número.
 * É o teste do próprio atendente, não o disparo da base. Por isso não passa
 * pelo portão de campanha fria: um número digitado na hora, uma vez.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { pathDeMidiaDaOrg } from "@/lib/campanhas/midia";
import {
  escolherSessaoParaCampanha,
  type SessaoDaCampanha,
} from "@/lib/campanhas/sessao-da-campanha";
import { getAdapter } from "@/lib/channels";
import {
  CHANNEL_SESSION_REF_COLUMNS,
  resolveSessionRef,
  type ChannelSessionRef,
} from "@/lib/channels/session-ref";
import type { OutboundKind } from "@/lib/channels/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneBR } from "@/lib/webhooks/inbound";

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().trim().min(8).max(24),
  body: z.string().max(2000).default(""),
  storage_path: z.string().min(1).max(400).optional(),
  mime: z.string().min(1).max(80).optional(),
  kind: z.enum(["image", "video", "audio", "document"]).optional(),
  filename: z.string().min(1).max(160).optional(),
  channel_session_id: z.string().uuid().optional(),
});

function mimeDoKind(kind: "image" | "video" | "audio" | "document"): string {
  if (kind === "image") return "image/jpeg";
  if (kind === "video") return "video/mp4";
  if (kind === "audio") return "audio/ogg";
  return "application/pdf";
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("agent", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return fail("validation_failed", "Informe o número e a mensagem.", 422, { requestId });
  }
  const input = parsed.data;
  const phone = normalizePhoneBR(input.phone);
  if (!phone) {
    return fail("validation_failed", "Número inválido. Use DDD + celular, com ou sem +55.", 422, {
      requestId,
    });
  }
  if (!input.body.trim() && !input.storage_path) {
    return fail("validation_failed", "Escreva a mensagem ou anexe um arquivo.", 422, { requestId });
  }
  if (input.storage_path && !pathDeMidiaDaOrg(input.storage_path, authz.org.orgId)) {
    return fail("forbidden", "Arquivo fora desta organização.", 403, { requestId });
  }

  const admin = createAdminClient();
  const { data: sessoes, error: sessErr } = await admin
    .from("channel_sessions")
    .select(`id, status, phone_number, archived_at, ${CHANNEL_SESSION_REF_COLUMNS}`)
    .eq("organization_id", authz.org.orgId);
  if (sessErr) return fail("internal_error", "Não foi possível ler o canal.", 500, { requestId });

  const irmas = (sessoes ?? []) as SessaoDaCampanha[];
  const pedida = input.channel_session_id
    ? (irmas.find((s) => s.id === input.channel_session_id) ?? null)
    : null;
  const sessao = escolherSessaoParaCampanha(pedida, irmas);
  if (!sessao) {
    return fail("provider_indisponivel", "Nenhum WhatsApp conectado para enviar o teste.", 409, {
      requestId,
    });
  }

  const adapter = getAdapter(sessao.provider);
  if (!adapter.isConfigured()) {
    return fail("provider_indisponivel", "O canal de WhatsApp não está configurado.", 409, {
      requestId,
    });
  }

  let mediaUrl: string | null = null;
  if (input.storage_path) {
    const { data: signed, error: signErr } = await admin.storage
      .from("whatsapp-media")
      .createSignedUrl(input.storage_path, 600);
    if (signErr || !signed?.signedUrl) {
      return fail("internal_error", "Não consegui preparar o arquivo para envio.", 500, { requestId });
    }
    mediaUrl = signed.signedUrl;
  }

  const destino =
    adapter.resolveRecipient({
      isGroup: false,
      groupChatId: null,
      phoneNumber: phone,
      waIdentity: null,
      waLid: null,
    }) ?? phone.replace(/\D/g, "");

  const kind: OutboundKind = input.storage_path ? (input.kind ?? "image") : "text";
  let sessionRef: string;
  try {
    sessionRef = resolveSessionRef(sessao as unknown as ChannelSessionRef);
  } catch {
    return fail("provider_indisponivel", "O número conectado não tem identificador de envio.", 409, {
      requestId,
    });
  }

  try {
    await adapter.send({
      organizationId: authz.org.orgId,
      sessionRef,
      to: destino,
      kind,
      body: input.body,
      media: mediaUrl
        ? {
            url: mediaUrl,
            mime: input.mime || mimeDoKind(input.kind ?? "image"),
            filename: input.filename,
            caption: kind === "audio" ? null : input.body,
          }
        : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "send_failed";
    return fail("send_failed", `O teste não saiu: ${message}`.slice(0, 240), 502, { requestId });
  }

  void audit({
    action: "campaign.test_send",
    requestId,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    resourceType: "campaigns",
    metadata: { has_media: Boolean(input.storage_path), kind },
  });

  return ok({ sent: true }, { requestId });
}
