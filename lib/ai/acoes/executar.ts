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
  if (pedido.requested_action === "create_task") {
    return criarProximoPassoDoPedido(db, pedido);
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

/**
 * `create_task` da policy = próxima ação canônica (`demandas.proximo_passo`).
 * Sem tabela `tasks`. Sem appointment.
 */
async function criarProximoPassoDoPedido(
  db: Queryable,
  pedido: PedidoDeAcaoRow,
): Promise<Record<string, unknown>> {
  const texto =
    stringDoPayload(pedido.payload, "proximo_passo") ??
    stringDoPayload(pedido.payload, "title") ??
    stringDoPayload(pedido.payload, "texto");
  if (!texto || texto.trim().length < 3) {
    throw new Error("create_task exige proximo_passo (3+ caracteres).");
  }
  const quando = stringDoPayload(pedido.payload, "proximo_passo_em");
  const contactId = stringDoPayload(pedido.payload, "contact_id") ?? pedido.contact_id;
  if (!contactId) throw new Error("create_task exige contact_id.");

  const { rows: abertas } = await db.query<{ id: string }>(
    `select id from demandas
      where organization_id = $1 and contact_id = $2 and fechada_em is null
      order by aberta_em asc limit 1`,
    [pedido.organization_id, contactId],
  );

  const leadId = stringDoPayload(pedido.payload, "lead_id") ?? pedido.lead_id;
  const dono =
    stringDoPayload(pedido.payload, "user_id") ?? pedido.executed_by ?? pedido.confirmed_by;
  let demandaId = abertas[0]?.id;
  if (!demandaId) {
    const { rows } = await db.query<{ id: string }>(
      `insert into demandas (
         organization_id, contact_id, lead_id, origem, estado,
         dono_kind, dono_user_id, proximo_passo, proximo_passo_em
       ) values ($1,$2,$3,'derivada','em_atendimento',$4,$5,$6,$7)
       returning id`,
      [
        pedido.organization_id,
        contactId,
        leadId,
        dono ? "humano" : "ia",
        dono,
        texto.trim(),
        quando,
      ],
    );
    demandaId = rows[0]?.id;
    if (pedido.conversation_id && demandaId) {
      await db.query(
        `insert into demanda_conversas (organization_id, demanda_id, conversation_id)
         values ($1,$2,$3) on conflict do nothing`,
        [pedido.organization_id, demandaId, pedido.conversation_id],
      );
    }
  } else {
    await db.query(
      `update demandas
          set proximo_passo = $3, proximo_passo_em = $4,
              dono_kind = 'humano', dono_user_id = coalesce($5, dono_user_id),
              updated_at = now()
        where organization_id = $1 and id = $2 and fechada_em is null`,
      [pedido.organization_id, demandaId, texto.trim(), quando, dono],
    );
  }
  return { demanda_id: demandaId, proximo_passo: texto.trim(), via: "create_task" };
}

function stringDoPayload(payload: Record<string, unknown>, chave: string): string | null {
  const v = payload[chave];
  return typeof v === "string" && v.length > 0 ? v : null;
}
