/**
 * Depois de autorizar: inscreve o webhook e puxa o Direct que a Graph já vê.
 *
 * Sem `subscribed_apps` a Meta autoriza a conta e não entrega DM. Sem o
 * puxão, conversa que já estava no Instagram não entra na Inbox — a
 * plataforma não devolve histórico sozinha.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import { ingestDirectInbound } from "./ingest";
import type { DirectInboundEvent } from "./webhook";

function graphVersion(): string {
  return process.env.META_GRAPH_VERSION ?? "v22.0";
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function inscreverWebhookDoDirect(input: {
  token: string;
  accountId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const accountId = input.accountId.trim();
  const token = input.token.trim();
  if (!accountId || !token) return { ok: false, reason: "credencial_ausente" };

  const url = `https://graph.instagram.com/${graphVersion()}/${encodeURIComponent(accountId)}/subscribed_apps`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ subscribed_fields: "messages" }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok || body.error) {
      return { ok: false, reason: body.error?.message ?? `http_${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "rede" };
  }
}

export function mensagensDoDirectDaGraph(
  body: unknown,
  accountId: string,
): DirectInboundEvent[] {
  const raiz = obj(body);
  const filas = Array.isArray(raiz?.data) ? raiz.data : [];
  const out: DirectInboundEvent[] = [];

  for (const fila of filas) {
    const conv = obj(fila);
    const mensagens = obj(conv?.messages);
    const itens = Array.isArray(mensagens?.data) ? mensagens.data : [];
    for (const item of itens) {
      const msg = obj(item);
      if (!msg) continue;
      const from = obj(msg.from);
      const fromId = str(from?.id);
      const mid = str(msg.id);
      if (!fromId || !mid) continue;
      if (fromId === accountId) continue;

      const quando = str(msg.created_time);
      out.push({
        kind: "inbound_message",
        accountId,
        from: fromId,
        username: str(from?.username),
        externalId: mid,
        text: str(msg.message),
        sentAt: quando ? new Date(quando) : new Date(),
        referral: null,
      });
    }
  }
  return out;
}

export async function listarMensagensDoDirect(input: {
  token: string;
  accountId: string;
}): Promise<DirectInboundEvent[]> {
  const fields =
    "id,updated_time,participants{id,username},messages.limit(20){id,created_time,from,message}";
  const url = `https://graph.instagram.com/${graphVersion()}/me/conversations?platform=instagram&fields=${encodeURIComponent(fields)}&limit=25`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${input.token.trim()}` },
  });
  const body: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = obj(body)?.error;
    const msg = obj(err)?.message;
    throw new Error(typeof msg === "string" ? msg : `http_${res.status}`);
  }
  return mensagensDoDirectDaGraph(body, input.accountId);
}

export async function receberDirectAposAutorizar(
  admin: SupabaseClient,
  input: { organizationId: string; accountId: string; token: string },
): Promise<{ subscribed: boolean; imported: number }> {
  const inscricao = await inscreverWebhookDoDirect({
    token: input.token,
    accountId: input.accountId,
  });
  if (!inscricao.ok) {
    logger.warn("direct.inscrever_webhook", { reason: inscricao.reason ?? "falhou" });
  }

  let eventos: DirectInboundEvent[] = [];
  try {
    eventos = await listarMensagensDoDirect({
      token: input.token,
      accountId: input.accountId,
    });
  } catch (err) {
    logger.warn("direct.listar_legado", {
      reason: err instanceof Error ? err.message : "falhou",
    });
    return { subscribed: inscricao.ok, imported: 0 };
  }

  let imported = 0;
  for (const evento of eventos) {
    const r = await ingestDirectInbound(admin, evento, {
      organizationId: input.organizationId,
    });
    if (r.status === "ingested") imported += 1;
  }
  return { subscribed: inscricao.ok, imported };
}
