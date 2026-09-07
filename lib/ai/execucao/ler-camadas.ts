/**
 * Carrega as cinco camadas do resolvedor. Lookup falho NÃO inventa OFF —
 * a camada some e o last-second gate da Etapa 1 continua sendo a defesa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Queryable } from "@/lib/agent-engine/queue/queue";
import { decidirEnvioConversacional, type FatosDoComando } from "@/lib/inbox/comando-da-conversa";
import { canalEmOff, globalAiExecutionOff, resolveAiExecutionPolicy, type AiExecutionPolicy, type CamadasDaPolitica } from "./politica";
import { lerAiMode, type AiMode } from "./modos";

export interface IdsParaPolitica {
  organizationId: string;
  conversationId?: string | null;
  contactId?: string | null;
  channelSessionId?: string | null;
  agentId?: string | null;
}

export function politicaDeCamadasParciais(parcial: Partial<CamadasDaPolitica> & { tenantMode?: AiMode }): AiExecutionPolicy {
  return resolveAiExecutionPolicy({
    globalOff: parcial.globalOff ?? globalAiExecutionOff(),
    tenantMode: parcial.tenantMode ?? "autonomous",
    channelOff: parcial.channelOff ?? false,
    agentOff: parcial.agentOff ?? false,
    conversationDeny: parcial.conversationDeny ?? null,
  });
}

export async function lerPoliticaSupabase(
  admin: SupabaseClient,
  ids: IdsParaPolitica,
  fatosDoComando?: FatosDoComando | null,
): Promise<AiExecutionPolicy> {
  const camadas: CamadasDaPolitica = {
    globalOff: globalAiExecutionOff(),
    tenantMode: "autonomous",
    channelOff: false,
    agentOff: false,
    conversationDeny: null,
  };

  try {
    const { data } = await admin
      .from("organizations")
      .select("settings")
      .eq("id", ids.organizationId)
      .maybeSingle();
    const settings = (data as { settings?: Record<string, unknown> } | null)?.settings;
    camadas.tenantMode = lerAiMode(settings?.ai_mode);
  } catch {
    // fail-open nesta camada
  }

  if (ids.channelSessionId) {
    try {
      const { data } = await admin
        .from("channel_sessions")
        .select("metadata")
        .eq("id", ids.channelSessionId)
        .eq("organization_id", ids.organizationId)
        .maybeSingle();
      camadas.channelOff = canalEmOff((data as { metadata?: unknown } | null)?.metadata);
    } catch {
      // fail-open
    }
  }

  if (ids.agentId) {
    try {
      const { data } = await admin
        .from("ai_agents")
        .select("published_version_id, archived_at")
        .eq("id", ids.agentId)
        .eq("organization_id", ids.organizationId)
        .maybeSingle();
      const row = data as { published_version_id?: string | null; archived_at?: string | null } | null;
      camadas.agentOff = !row || row.archived_at != null || !row.published_version_id;
    } catch {
      // fail-open
    }
  }

  if (fatosDoComando) {
    const decisao = decidirEnvioConversacional(fatosDoComando);
    if (!decisao.permitido) {
      camadas.conversationDeny = { codigo: decisao.codigo, motivo: decisao.motivo };
    }
  }

  return resolveAiExecutionPolicy(camadas);
}

export async function lerPoliticaPg(db: Queryable, ids: IdsParaPolitica): Promise<AiExecutionPolicy> {
  const camadas: CamadasDaPolitica = {
    globalOff: globalAiExecutionOff(),
    tenantMode: "autonomous",
    channelOff: false,
    agentOff: false,
    conversationDeny: null,
  };

  try {
    const { rows } = await db.query<{ mode: string | null }>(
      `select settings->>'ai_mode' as mode from organizations where id = $1`,
      [ids.organizationId],
    );
    camadas.tenantMode = lerAiMode(rows[0]?.mode);
  } catch {
    // fail-open
  }

  if (ids.channelSessionId) {
    try {
      const { rows } = await db.query<{ metadata: unknown }>(
        `select metadata from channel_sessions where organization_id = $1 and id = $2`,
        [ids.organizationId, ids.channelSessionId],
      );
      camadas.channelOff = canalEmOff(rows[0]?.metadata);
    } catch {
      // fail-open
    }
  }

  if (ids.agentId) {
    try {
      const { rows } = await db.query<{ off: boolean }>(
        `select (archived_at is not null or published_version_id is null) as off
           from ai_agents where organization_id = $1 and id = $2`,
        [ids.organizationId, ids.agentId],
      );
      if (rows[0]) camadas.agentOff = rows[0].off;
    } catch {
      // fail-open
    }
  }

  if (ids.conversationId) {
    try {
      const { rows } = await db.query<{
        status: string;
        assigned_to_user_id: string | null;
        assignee_kind: string | null;
        bot_silenced_until: string | null;
        force_human: boolean | null;
        is_blocked: boolean | null;
      }>(
        `select c.status, c.assigned_to_user_id, c.assignee_kind, c.bot_silenced_until,
                ct.force_human, ct.is_blocked
           from conversations c
           join contacts ct on ct.id = c.contact_id and ct.organization_id = c.organization_id
          where c.organization_id = $1 and c.id = $2`,
        [ids.organizationId, ids.conversationId],
      );
      const row = rows[0];
      if (row) {
        const decisao = decidirEnvioConversacional({
          status: row.status,
          assigned_to_user_id: row.assigned_to_user_id,
          assignee_kind: row.assignee_kind,
          bot_silenced_until: row.bot_silenced_until,
          force_human: row.force_human,
          is_blocked: row.is_blocked,
        });
        if (!decisao.permitido) {
          camadas.conversationDeny = { codigo: decisao.codigo, motivo: decisao.motivo };
        }
      }
    } catch {
      // fail-open
    }
  }

  return resolveAiExecutionPolicy(camadas);
}
