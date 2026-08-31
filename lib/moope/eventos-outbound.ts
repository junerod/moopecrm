/**
 * Eventos que o CRM MANDA — atendimento → cadastro.
 *
 * HMAC no header. Se o webhook falhar, o event_log fica pending e o drain
 * tenta de novo (laço de retorno).
 */
import { createHmac } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EventRow, HandlerResult } from "@/lib/event-log/dispatcher";
import { decryptWebhookSecret } from "@/lib/webhooks/secrets";
import type { MoopeConnectionRow, MoopeOutboundType } from "@/lib/moope/tipos";
import { MOOPE_OUTBOUND_TYPES } from "@/lib/moope/tipos";

export const MOOPE_OUTBOUND_HANDLER_KEY = "moope-outbound.v1";

export function assinarSaida(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

export function ehEventoDeSaida(tipo: string): tipo is MoopeOutboundType {
  return (MOOPE_OUTBOUND_TYPES as readonly string[]).includes(tipo);
}

export async function entregarEventoAoParceiro(
  admin: SupabaseClient,
  row: EventRow,
  deps: {
    fetchFn?: typeof fetch;
    agora?: Date;
  } = {},
): Promise<HandlerResult> {
  if (!ehEventoDeSaida(row.event_type)) {
    return { consumer_key: MOOPE_OUTBOUND_HANDLER_KEY, status: "skipped", detail: "nao_e_saida" };
  }

  const { data: conexao } = await admin
    .from("moope_connections")
    .select(
      "id, organization_id, kind, partner_webhook_url, inbound_key_prefix, inbound_key_hash, outbound_secret_enc, status",
    )
    .eq("organization_id", row.organization_id)
    .eq("status", "active")
    .maybeSingle();

  const conn = conexao as MoopeConnectionRow | null;
  if (!conn?.partner_webhook_url) {
    return { consumer_key: MOOPE_OUTBOUND_HANDLER_KEY, status: "skipped", detail: "sem_webhook" };
  }
  if (!conn.outbound_secret_enc) {
    return { consumer_key: MOOPE_OUTBOUND_HANDLER_KEY, status: "skipped", detail: "sem_segredo" };
  }

  const secret = await decryptWebhookSecret(admin, conn.outbound_secret_enc);
  if (!secret) {
    return {
      consumer_key: MOOPE_OUTBOUND_HANDLER_KEY,
      status: "retry",
      retry_at: new Date(Date.now() + 60_000).toISOString(),
      detail: "cifra_indisponivel",
    };
  }

  const moopeExternalId = await resolverExternalId(admin, row);
  const corpo = JSON.stringify({
    type: row.event_type,
    occurred_at: (deps.agora ?? new Date()).toISOString(),
    organization_id: row.organization_id,
    moope_external_id: moopeExternalId,
    entity_kind: row.entity_kind,
    entity_id: row.entity_id,
    payload: row.payload ?? {},
  });

  const fetchFn = deps.fetchFn ?? fetch;
  try {
    const res = await fetchFn(conn.partner_webhook_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Moope-Signature": assinarSaida(secret, corpo),
      },
      body: corpo,
    });
    if (!res.ok) {
      return {
        consumer_key: MOOPE_OUTBOUND_HANDLER_KEY,
        status: "retry",
        retry_at: new Date(Date.now() + 60_000).toISOString(),
        detail: `http_${res.status}`,
      };
    }
    return { consumer_key: MOOPE_OUTBOUND_HANDLER_KEY, status: "ok" };
  } catch (err) {
    return {
      consumer_key: MOOPE_OUTBOUND_HANDLER_KEY,
      status: "retry",
      retry_at: new Date(Date.now() + 60_000).toISOString(),
      detail: err instanceof Error ? err.message : "rede",
    };
  }
}

async function resolverExternalId(admin: SupabaseClient, row: EventRow): Promise<string | null> {
  const doPayload = row.payload?.moope_external_id;
  if (typeof doPayload === "string" && doPayload) return doPayload;

  if (row.entity_kind === "contact" && row.entity_id) {
    const { data } = await admin
      .from("contacts")
      .select("source_metadata")
      .eq("id", row.entity_id)
      .eq("organization_id", row.organization_id)
      .maybeSingle();
    const meta = (data as { source_metadata?: Record<string, unknown> } | null)?.source_metadata;
    const id = meta?.moope_external_id;
    return typeof id === "string" ? id : null;
  }

  if ((row.entity_kind === "crm_lead" || row.entity_kind === "lead") && row.entity_id) {
    const { data } = await admin
      .from("crm_leads")
      .select("source_metadata, contact_id")
      .eq("id", row.entity_id)
      .eq("organization_id", row.organization_id)
      .maybeSingle();
    const lead = data as { source_metadata?: Record<string, unknown>; contact_id?: string | null } | null;
    const doLead = lead?.source_metadata?.moope_external_id;
    if (typeof doLead === "string") return doLead;
    if (lead?.contact_id) {
      const { data: c } = await admin
        .from("contacts")
        .select("source_metadata")
        .eq("id", lead.contact_id)
        .eq("organization_id", row.organization_id)
        .maybeSingle();
      const id = (c as { source_metadata?: Record<string, unknown> } | null)?.source_metadata
        ?.moope_external_id;
      return typeof id === "string" ? id : null;
    }
  }

  if (row.entity_kind === "conversation" && row.entity_id) {
    const contactId = typeof row.payload?.contact_id === "string" ? row.payload.contact_id : null;
    if (!contactId) return null;
    const { data } = await admin
      .from("contacts")
      .select("source_metadata")
      .eq("id", contactId)
      .eq("organization_id", row.organization_id)
      .maybeSingle();
    const id = (data as { source_metadata?: Record<string, unknown> } | null)?.source_metadata
      ?.moope_external_id;
    return typeof id === "string" ? id : null;
  }

  return null;
}
