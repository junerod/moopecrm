/**
 * Envio comercial de campanha pelo seam de canal.
 *
 * Mora aqui porque pergunta capabilities e chama adapter — feature nenhuma
 * nomeia provider. QR (banRisk) nunca dispara campanha comercial.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { capabilitiesOf } from "@/lib/channels/capabilities";
import { getAdapter } from "@/lib/channels/index";
import { sendTemplateForSession } from "@/lib/channels/meta/send-template-for-session";
import type { ChannelProvider, OutboundKind } from "@/lib/channels/types";

export interface PedidoDeEnvioWhatsappCampanha {
  organizationId: string;
  provider: ChannelProvider;
  sessionRef: string;
  to: string;
  body: string;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateValues?: Record<string, string>;
  media?: { url: string; filename?: string; kind: "image" | "video" | "document" } | null;
}

export type ResultadoEnvioWhatsappCampanha =
  | { ok: true; via: "real"; externalId: string | null }
  | { ok: false; reason: string; via: "real" };

export function campanhaComercialPermitidaPelasCaps(provider: ChannelProvider): boolean {
  const caps = capabilitiesOf(provider);
  return caps.requiresTemplates && !caps.banRisk;
}

export function campanhaExigeTemplatePelasCaps(provider: ChannelProvider): boolean {
  return capabilitiesOf(provider).requiresTemplates;
}

export function midiaPermitidaPelasCaps(
  provider: ChannelProvider,
  kind: "image" | "video" | "document",
): boolean {
  const caps = capabilitiesOf(provider);
  if (caps.banRisk) return false;
  void kind;
  return true;
}

export async function enviarWhatsappDaCampanha(
  _db: SupabaseClient,
  pedido: PedidoDeEnvioWhatsappCampanha,
): Promise<ResultadoEnvioWhatsappCampanha> {
  const caps = capabilitiesOf(pedido.provider);
  if (caps.banRisk) {
    return { ok: false, reason: "qr_nao_dispara_campanha", via: "real" };
  }
  if (caps.requiresTemplates && !pedido.templateName) {
    return { ok: false, reason: "template_oficial_obrigatorio", via: "real" };
  }

  const adapter = getAdapter(pedido.provider);
  if (!adapter.isConfigured()) {
    return { ok: false, reason: "provider_indisponivel", via: "real" };
  }

  if (caps.requiresTemplates && pedido.provider === "meta_cloud") {
    try {
      const externalId = await sendTemplateForSession(_db, {
        organizationId: pedido.organizationId,
        to: pedido.to.replace(/\D/g, ""),
        name: pedido.templateName!,
        language: pedido.templateLanguage ?? "pt_BR",
        values: pedido.templateValues ?? {},
      });
      return { ok: true, via: "real", externalId };
    } catch (err) {
      return {
        ok: false,
        reason: err instanceof Error ? err.message : "send_failed",
        via: "real",
      };
    }
  }

  const kind: OutboundKind = pedido.media ? pedido.media.kind : "text";
  try {
    const r = await adapter.send({
      organizationId: pedido.organizationId,
      sessionRef: pedido.sessionRef,
      to: pedido.to.replace(/\D/g, ""),
      kind,
      body: pedido.body,
      media: pedido.media
        ? {
            url: pedido.media.url,
            mime: "application/octet-stream",
            filename: pedido.media.filename,
            caption: pedido.body,
          }
        : undefined,
    });
    return { ok: true, via: "real", externalId: r.externalId };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "send_failed",
      via: "real",
    };
  }
}
