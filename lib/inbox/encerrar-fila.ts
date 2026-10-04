/**
 * Encerra todas as conversas ainda em trabalho de UMA organização.
 * Histórico fica. A próxima mensagem do cliente reabre (migration 0212).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** O que a fila, Minhas e a aba IA ainda tratam como trabalho. */
export const STATUS_EM_TRABALHO = [
  "open",
  "pending",
  "claimed",
  "ai_handling",
  "resolved",
] as const;

export async function encerrarFila(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ encerradas: number }> {
  const agora = new Date().toISOString();
  let encerradas = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("organization_id", organizationId)
      .in("status", [...STATUS_EM_TRABALHO])
      .limit(200);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    const ids = data.map((r) => r.id as string);
    const { error: updErr } = await supabase
      .from("conversations")
      .update({ status: "closed", status_changed_at: agora })
      .in("id", ids)
      .eq("organization_id", organizationId);
    if (updErr) throw new Error(updErr.message);

    await supabase
      .from("conversations")
      .update({ bot_silenced_until: null })
      .in("id", ids)
      .eq("organization_id", organizationId)
      .is("last_handoff_at", null);

    encerradas += ids.length;
  }

  return { encerradas };
}
