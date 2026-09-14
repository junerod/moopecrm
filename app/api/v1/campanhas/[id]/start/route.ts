import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { authorizeAiAction } from "@/lib/ai/acoes/autorizar";
import { carregarContatosDoSegmento } from "@/lib/campanhas/carregar-contatos";
import { campanhaExigeTemplateOficial } from "@/lib/campanhas/capabilities";
import { diagnosticoDeDispatch } from "@/lib/campanhas/diagnostico";
import { previewDaCampanha } from "@/lib/campanhas/preview";
import { estimarSegmento } from "@/lib/campanhas/segmento";
import {
  escolherSessaoParaCampanha,
  type SessaoDaCampanha,
} from "@/lib/campanhas/sessao-da-campanha";
import { lerSettings } from "@/lib/campanhas/settings";
import { campanhaQrExigeConversaExistente } from "@/lib/channels/campaign-send";
import { CHANNEL_SESSION_REF_COLUMNS } from "@/lib/channels/session-ref";
import { podeTransitarCampanha } from "@/lib/campanhas/transicoes";
import {
  LIMITE_CONFIRMACAO_LOTE,
  segmentoVazio,
  type SegmentoDaCampanha,
  type StatusDaCampanha,
} from "@/lib/campanhas/tipos";
import { processarTickDasCampanhas } from "@/lib/campanhas/worker";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ChannelProvider } from "@/lib/channels/types";

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
  const settings = lerSettings((camp as { settings?: unknown }).settings);
  if (!podeTransitarCampanha(status, "running") && status !== "running" && !settings.preparing) {
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

  const { data: sessoes } = await supabase
    .from("channel_sessions")
    .select(`id, status, phone_number, archived_at, ${CHANNEL_SESSION_REF_COLUMNS}`)
    .eq("organization_id", authz.org.orgId);
  const irmas = (sessoes ?? []) as SessaoDaCampanha[];
  const pedidaId = (camp as { channel_session_id: string | null }).channel_session_id;
  const pedida = pedidaId ? (irmas.find((s) => s.id === pedidaId) ?? null) : null;
  const escolhida = escolherSessaoParaCampanha(pedida, irmas);
  const sessionId = escolhida?.id ?? pedidaId;
  const provider = (escolhida?.provider ?? pedida?.provider ?? null) as ChannelProvider | null;

  const selecaoPreliminar = settings.channels ?? "whatsapp";
  const querWhatsapp = selecaoPreliminar !== "email";
  const diag = diagnosticoDeDispatch({
    provider,
    templateId: (camp as { template_id: string | null }).template_id,
  });
  if (
    querWhatsapp &&
    provider &&
    campanhaExigeTemplateOficial(provider) &&
    !(camp as { template_id: string | null }).template_id &&
    diag.whatsapp === "real"
  ) {
    return fail(
      "validation_failed",
      "Este canal exige modelo oficial aprovado para campanha WhatsApp.",
      422,
      { requestId },
    );
  }

  const segmento = ((camp as { segment: SegmentoDaCampanha }).segment ?? {}) as SegmentoDaCampanha;
  const selecao = settings.channels ?? "whatsapp";
  const contatos = await carregarContatosDoSegmento(supabase, authz.org.orgId, segmento);
  const { count: totalBase } = await supabase
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", authz.org.orgId)
    .is("is_merged_into", null)
    .eq("is_anonymized", false);
  const est = estimarSegmento(contatos, segmento, selecao, totalBase ?? undefined);

  if (segmentoVazio(segmento) && est.atinge_base_inteira && !settings.confirm_all_base) {
    return fail(
      "validation_failed",
      "Esta campanha atingirá toda a sua base. Confirme no passo Revisar.",
      422,
      { requestId },
    );
  }
  if (est.elegiveis > LIMITE_CONFIRMACAO_LOTE && !settings.confirm_large) {
    return fail(
      "validation_failed",
      `Confirme o envio para ${est.elegiveis} contatos.`,
      422,
      { requestId },
    );
  }

  const agora = new Date().toISOString();
  await supabase
    .from("campaigns")
    .update({
      channel_session_id: sessionId ?? (camp as { channel_session_id: string | null }).channel_session_id,
      settings: {
        ...settings,
        preparing: true,
        materializing: true,
        somente_conversa_existente: provider
          ? campanhaQrExigeConversaExistente(provider)
          : settings.somente_conversa_existente,
      },
      updated_at: agora,
    })
    .eq("id", id)
    .eq("organization_id", authz.org.orgId);

  void processarTickDasCampanhas(createAdminClient()).catch(() => undefined);

  void audit({
    action: "campaign.started",
    requestId,
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    resourceType: "campaigns",
    resourceId: id,
    metadata: {
      preparing: true,
      elegiveis: est.elegiveis,
      dispatch: diag,
    },
  });

  return ok(
    {
      status: "draft",
      preparing: true,
      elegiveis: est.elegiveis,
      destinos: est.destinos,
      dispatch: diag,
    },
    { requestId },
  );
}
