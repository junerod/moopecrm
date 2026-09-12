import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { authorizeAiAction } from "@/lib/ai/acoes/autorizar";
import { carregarContatosDoSegmento } from "@/lib/campanhas/carregar-contatos";
import { campanhaComercialRealPermitida } from "@/lib/campanhas/capabilities";
import { previewDaCampanha } from "@/lib/campanhas/preview";
import { estimarSegmento } from "@/lib/campanhas/segmento";
import { podeTransitarCampanha } from "@/lib/campanhas/transicoes";
import { materializarDestinatarios } from "@/lib/campanhas/worker";
import type { SegmentoDaCampanha, StatusDaCampanha } from "@/lib/campanhas/tipos";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "campaigns" });
  if (!authz.ok) return authz.response;
  const { id } = await ctx.params;

  const ia = authorizeAiAction({ action: "campaign_dispatch", ai_mode: "copilot" });
  if (ia.verdict === "ALLOW") {
    return fail("forbidden", "Campanha exige ação humana explícita.", 403, { requestId });
  }

  const supabase = await createClient();
  const { data: camp } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("organization_id", authz.org.orgId)
    .maybeSingle();
  if (!camp) return fail("not_found", "Campanha não encontrada.", 404, { requestId });

  const status = (camp as { status: StatusDaCampanha }).status;
  if (!podeTransitarCampanha(status, "running") && status !== "running") {
    return fail("state_conflict", "Esta campanha não pode ser disparada.", 409, { requestId });
  }

  const body = (camp as { body_text: string }).body_text;
  const preview = previewDaCampanha({
    template: body,
    valores: { nome: "Maria", telefone: "+5511999990000", email: "maria@exemplo.com" },
  });
  if (preview.desconhecidas.length > 0) {
    return fail("validation_failed", "Template tem variável desconhecida.", 422, { requestId });
  }

  const sessionId = (camp as { channel_session_id: string | null }).channel_session_id;
  if (sessionId) {
    const { data: sess } = await supabase
      .from("channel_sessions")
      .select("provider")
      .eq("id", sessionId)
      .eq("organization_id", authz.org.orgId)
      .maybeSingle();
    const provider = (sess as { provider?: string } | null)?.provider;
    if (provider === "waha") {
      // QR não dispara campanha REAL; o worker desta rodada é mock.
    } else if (provider && !campanhaComercialRealPermitida(provider as never)) {
      return fail("validation_failed", "Este canal não dispara campanha comercial.", 422, {
        requestId,
      });
    }
  }

  const segmento = ((camp as { segment: SegmentoDaCampanha }).segment ?? {}) as SegmentoDaCampanha;
  const contatos = await carregarContatosDoSegmento(supabase, authz.org.orgId, segmento);
  const est = estimarSegmento(contatos, segmento);
  const { inseridos, pulados } = await materializarDestinatarios(supabase, {
    organizationId: authz.org.orgId,
    campaignId: id,
    contactIds: est.ids,
    contatos,
  });

  const agora = new Date().toISOString();
  const scheduled = (camp as { scheduled_at: string | null }).scheduled_at;
  const vaiAgora = !scheduled || new Date(scheduled).getTime() <= Date.now();
  const novoStatus: StatusDaCampanha = vaiAgora ? "running" : "scheduled";

  await supabase
    .from("campaigns")
    .update({
      status: novoStatus,
      started_at: vaiAgora ? agora : null,
      updated_at: agora,
    })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId);

  void audit({
    action: "campaign.started",
    requestId,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    resourceType: "campaigns",
    resourceId: id,
    metadata: { inseridos, pulados, status: novoStatus, via: "mock" },
  });

  return ok({ status: novoStatus, inseridos, pulados, via: "mock" }, { requestId });
}
