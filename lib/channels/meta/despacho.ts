/**
 * O que fazer com um POST do app Meta depois da assinatura conferir.
 *
 * A rota não pergunta QUAL objeto chegou — ela entrega o envelope. WhatsApp
 * e Direct compartilham o mesmo callback; quem separa é isto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ingestDirectInbound } from "@/lib/channels/instagram/ingest";
import { envelopeEhDirect, parseDirectWebhook } from "@/lib/channels/instagram/webhook";
import { logger } from "@/lib/logger";

import type { MetaWebhookEnvelope } from "./envelope";
import { ingestMetaInbound } from "./ingest";
import type { MetaWebhookSession } from "./session";
import { parseMetaWebhook } from "./webhook";

export async function processarWebhookDoAppMeta(
  admin: SupabaseClient,
  envelope: MetaWebhookEnvelope,
  session: MetaWebhookSession,
): Promise<string[]> {
  const desfechos: string[] = [];

  if (envelopeEhDirect(envelope)) {
    for (const e of parseDirectWebhook(envelope)) {
      if (e.kind !== "inbound_message") {
        desfechos.push("echo");
        continue;
      }
      const r = await ingestDirectInbound(admin, e, {
        organizationId: session.organizationId,
      });
      desfechos.push(r.status);
      if (r.status === "failed" || r.status === "no_session") {
        logger.error("[direct.ingest] inbound não ingerido", {
          status: r.status,
          reason: r.status === "failed" ? r.reason : undefined,
          external_id: e.externalId,
        });
      }
    }
    return desfechos;
  }

  const now = new Date().toISOString();
  for (const e of parseMetaWebhook(envelope)) {
    if (session.wabaId && e.wabaId && e.wabaId !== session.wabaId) continue;

    if (e.kind === "inbound_message") {
      const r = await ingestMetaInbound(admin, e, {
        organizationId: session.organizationId,
      });
      desfechos.push(r.status);
      if (r.status === "failed" || r.status === "no_session") {
        logger.error("[meta.ingest] inbound não ingerido", {
          status: r.status,
          reason: r.status === "failed" ? r.reason : undefined,
          external_id: e.externalId,
        });
      }
      continue;
    }

    if (e.kind === "template_status") {
      await admin
        .from("meta_templates")
        .update({ status: e.event, rejected_reason: e.reason, updated_at: now })
        .eq("organization_id", session.organizationId)
        .eq("waba_id", e.wabaId)
        .eq("name", e.templateName)
        .eq("language", e.templateLanguage);
    } else {
      await admin
        .from("messages")
        .update({ status: e.status === "failed" ? "failed" : "sent", updated_at: now })
        .eq("organization_id", session.organizationId)
        .eq("external_id", e.externalId);
    }
  }

  return desfechos;
}
