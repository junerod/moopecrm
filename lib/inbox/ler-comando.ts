/**
 * Lê os fatos do comando no banco — o único I/O em torno de
 * `decidirEnvioConversacional`.
 *
 * A regra mora em `comando-da-conversa.ts` (pura). Aqui só o SELECT. Dois
 * clientes porque o agent-engine fala `pg` e o resto do app fala supabase-js;
 * os dois devolvem o mesmo shape para a mesma função.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  decidirEnvioConversacional,
  type DecisaoDeEnvioConversacional,
  type FatosDoComando,
} from "@/lib/inbox/comando-da-conversa";

export interface IdsDoComando {
  organizationId: string;
  conversationId: string;
}

interface Queryable {
  query(text: string, values?: unknown[]): Promise<{ rows: LinhaDoComando[] }>;
}

interface LinhaDoComando {
  status: string | null;
  assigned_to_user_id: string | null;
  assignee_kind: string | null;
  bot_silenced_until: unknown;
  force_human: boolean | null;
  is_blocked: boolean | null;
}

/** `infinity` do Postgres chega como literal, Date inválida ou Date não-finita. */
export function silencioComoTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor === "infinity") return "infinity";
  if (valor instanceof Date) {
    return Number.isFinite(valor.getTime()) ? valor.toISOString() : "infinity";
  }
  const texto = String(valor);
  return texto.length === 0 ? null : texto;
}

export function fatosDeLinha(row: LinhaDoComando): FatosDoComando {
  return {
    status: row.status ?? "open",
    assigned_to_user_id: row.assigned_to_user_id,
    assignee_kind: row.assignee_kind,
    bot_silenced_until: silencioComoTexto(row.bot_silenced_until),
    force_human: row.force_human === true,
    is_blocked: row.is_blocked === true,
  };
}

const COLUNAS = `
  c.status,
  c.assigned_to_user_id,
  c.assignee_kind,
  c.bot_silenced_until,
  ct.force_human,
  ct.is_blocked
`;

export async function lerFatosDoComandoPg(
  db: Queryable,
  ids: IdsDoComando,
): Promise<FatosDoComando | null> {
  const { rows } = await db.query(
    `select /* comando-da-conversa */ ${COLUNAS}
       from conversations c
       join contacts ct
         on ct.id = c.contact_id and ct.organization_id = c.organization_id
      where c.organization_id = $1 and c.id = $2
      limit 1`,
    [ids.organizationId, ids.conversationId],
  );
  return rows[0] ? fatosDeLinha(rows[0]) : null;
}

export async function lerFatosDoComandoSupabase(
  admin: SupabaseClient,
  ids: IdsDoComando,
): Promise<FatosDoComando | null> {
  const { data, error } = await admin
    .from("conversations")
    .select(
      "status, assigned_to_user_id, assignee_kind, bot_silenced_until, contacts:contact_id(force_human, is_blocked)",
    )
    .eq("id", ids.conversationId)
    .eq("organization_id", ids.organizationId)
    .maybeSingle();
  if (error || !data) return null;

  const row = data as unknown as {
    status: string | null;
    assigned_to_user_id: string | null;
    assignee_kind: string | null;
    bot_silenced_until: unknown;
    contacts: { force_human: boolean | null; is_blocked: boolean | null } | null;
  };
  return fatosDeLinha({
    status: row.status,
    assigned_to_user_id: row.assigned_to_user_id,
    assignee_kind: row.assignee_kind,
    bot_silenced_until: row.bot_silenced_until,
    force_human: row.contacts?.force_human ?? null,
    is_blocked: row.contacts?.is_blocked ?? null,
  });
}

/**
 * Sem linha = sem evidência de trava. O gate de envio só veta o que LEU.
 * Lookup falho no caminho de OTIMIZAÇÃO (pos-entrada) não pode calar o
 * despacho: a trava real é o before-send, que relê de novo.
 */
export function decidirAPartirDosFatos(
  fatos: FatosDoComando | null,
  agora?: Date,
): DecisaoDeEnvioConversacional {
  if (fatos === null) return { permitido: true };
  return decidirEnvioConversacional(fatos, agora);
}
