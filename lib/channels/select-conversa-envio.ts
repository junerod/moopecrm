/**
 * SELECT da conversa no caminho de SAÍDA (Inbox, automação, MCP, agente).
 *
 * O código chega ao clone por deploy; a migration chega à parte. Já aconteceu
 * de o SELECT nomear coluna que o banco ainda não tem (0106 `archived_at`,
 * 0201 `twilio_from`) e o POST /messages virar 500 ANTES do INSERT — zero
 * linha, toast `internal_error`, celular do atendente ainda manda e o
 * webhook entra. Sem a coluna, ela não tem valor: repetir o SELECT sem ela
 * é o resultado exato, não um paliativo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { ARCHIVED_AT, type DbErrorLike } from "./archived";
import { CHANNEL_SESSION_REF_COLUMNS } from "./session-ref";

const COLUNA_AUSENTE = new Set(["42703", "PGRST204"]);

/** Colunas do sessionRef que um banco atrasado pode ainda não ter. */
const SESSION_REF_ATRASADAS = ["twilio_from"] as const;

const CONTATO_ATRASADAS = ["wa_lid"] as const;

const CONTATO_BASE = [
  "phone_number",
  "wa_identity",
  "wa_lid",
  "is_blocked",
  "force_human",
] as const;

const CONVERSA_BASE =
  "id, organization_id, contact_id, channel_session_id, is_group, group_chat_id, status, assigned_to_user_id, assignee_kind, bot_silenced_until, provider_conversation_id";

export function isMissingDbColumn(
  error: DbErrorLike | null | undefined,
  column: string,
): boolean {
  if (!error) return false;
  return COLUNA_AUSENTE.has(error.code ?? "") && (error.message ?? "").includes(column);
}

export function montarSelectConversaEnvio(omitir: ReadonlySet<string>): string {
  const session = CHANNEL_SESSION_REF_COLUMNS.split(",")
    .map((c) => c.trim())
    .filter((c) => !omitir.has(c))
    .join(", ");
  const contato = CONTATO_BASE.filter((c) => !omitir.has(c)).join(", ");
  const archived = omitir.has(ARCHIVED_AT) ? "" : `, ${ARCHIVED_AT}`;
  return `${CONVERSA_BASE}, contacts:contact_id(${contato}), channel_sessions:channel_session_id(${session}, status${archived})`;
}

const CANDIDATAS_A_OMITIR = [
  ARCHIVED_AT,
  ...SESSION_REF_ATRASADAS,
  ...CONTATO_ATRASADAS,
] as const;

/**
 * Roda o SELECT da conversa e, só se o erro nomear coluna que um clone
 * atrasado pode não ter, tenta de novo sem ela.
 */
export async function carregarConversaDoEnvio(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<{ data: unknown; error: DbErrorLike | null }> {
  const omitir = new Set<string>();
  let last: { data: unknown; error: DbErrorLike | null } = {
    data: null,
    error: { message: "select_conversa_envio_sem_tentativa" },
  };

  for (let i = 0; i < CANDIDATAS_A_OMITIR.length + 1; i++) {
    const select = montarSelectConversaEnvio(omitir);
    last = await supabase
      .from("conversations")
      .select(select)
      .eq("id", conversationId)
      .maybeSingle();
    if (!last.error) return last;

    const hit = CANDIDATAS_A_OMITIR.find((c) => !omitir.has(c) && isMissingDbColumn(last.error, c));
    if (!hit) return last;
    omitir.add(hit);
  }
  return last;
}
