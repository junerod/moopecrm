/**
 * Efeito de marcar o papel na Inbox: Lead sem card aberto ganha um.
 * Cliente / Equipe / Ignorar só gravam o papel — o nascimento automático
 * já recusa os dois últimos.
 */
import { apiClient } from "@/lib/api/client";
import { SEM_NOME } from "@/lib/contacts/rotulo-do-contato";
import type { CrmSummaryData } from "@/lib/inbox/crm-summary-tipos";

export async function garantirLeadAoMarcar(opts: {
  contactId: string;
  contactName: string;
  summary: CrmSummaryData | null;
}): Promise<void> {
  if (!opts.summary || opts.summary.negocio.resolucao !== "nenhum") return;
  if (opts.summary.pipelines_utilizaveis.length === 0) return;

  const pipeline =
    opts.summary.pipelines_utilizaveis.find((p) => p.is_default) ??
    opts.summary.pipelines_utilizaveis[0]!;
  const stageId = pipeline.etapas[0]?.id;
  if (!stageId) return;

  const titulo =
    opts.contactName && opts.contactName !== SEM_NOME
      ? opts.contactName
      : "Negócio pelo WhatsApp";

  await apiClient.post("/api/v1/leads", {
    pipeline_id: pipeline.id,
    stage_id: stageId,
    title: titulo.slice(0, 200),
    contact_id: opts.contactId,
    source: "whatsapp",
    reuse_open_if_exists: true,
  });
}

export async function carregarResumoParaMarcar(
  contactId: string,
): Promise<CrmSummaryData | null> {
  try {
    const r = await apiClient.get<{ data: CrmSummaryData }>(
      `/api/v1/contacts/${contactId}/crm-summary`,
    );
    return r.data;
  } catch {
    return null;
  }
}
