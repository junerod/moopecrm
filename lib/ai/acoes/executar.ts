/**
 * Executores das ações que o CONTROLLED pode confirmar.
 * O ator é o humano que confirmou — não a IA.
 */
import type { Queryable } from "@/lib/agent-engine/queue/queue";
import type { PedidoDeAcaoRow } from "./pedidos";

export async function executarPedidoComoHumano(
  db: Queryable,
  pedido: PedidoDeAcaoRow,
): Promise<Record<string, unknown>> {
  if (pedido.requested_action === "move_lead_stage") {
    return moverLeadDoPedido(db, pedido);
  }
  throw new Error(`Ação ${pedido.requested_action} ainda não tem executor nesta etapa.`);
}

async function moverLeadDoPedido(
  db: Queryable,
  pedido: PedidoDeAcaoRow,
): Promise<Record<string, unknown>> {
  const leadId = stringDoPayload(pedido.payload, "lead_id") ?? pedido.lead_id;
  const stageId = stringDoPayload(pedido.payload, "stage_id");
  if (!leadId || !stageId) {
    throw new Error("move_lead_stage exige lead_id e stage_id.");
  }

  const { rows: leadRows } = await db.query<{
    id: string;
    stage_id: string;
    pipeline_id: string;
  }>(
    `select id, stage_id, pipeline_id from crm_leads
      where organization_id = $1 and id = $2`,
    [pedido.organization_id, leadId],
  );
  const lead = leadRows[0];
  if (!lead) throw new Error("Lead não encontrado.");

  if (lead.stage_id === stageId) {
    return { lead_id: lead.id, stage_id: stageId, already: true };
  }

  const { rows: stageRows } = await db.query<{ id: string; pipeline_id: string }>(
    `select id, pipeline_id from crm_stages
      where organization_id = $1 and id = $2`,
    [pedido.organization_id, stageId],
  );
  const stage = stageRows[0];
  if (!stage) throw new Error("Estágio não encontrado.");
  if (stage.pipeline_id !== lead.pipeline_id) {
    throw new Error("Move entre funis não é permitido.");
  }

  await db.query(
    `update crm_leads set stage_id = $3, updated_at = now()
      where organization_id = $1 and id = $2`,
    [pedido.organization_id, lead.id, stageId],
  );

  return {
    lead_id: lead.id,
    from_stage_id: lead.stage_id,
    to_stage_id: stageId,
  };
}

function stringDoPayload(payload: Record<string, unknown>, chave: string): string | null {
  const v = payload[chave];
  return typeof v === "string" && v.length > 0 ? v : null;
}
