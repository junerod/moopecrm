/**
 * Apaga os cards do funil de UMA organização. Contatos e conversas ficam.
 * Confirmação é a palavra ZERAR — o botão sozinho não basta.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CONFIRMACAO_DE_ESVAZIAR_FUNIL = "ZERAR";

export async function esvaziarFunil(
  supabase: SupabaseClient,
  organizationId: string,
  confirmacao: string,
): Promise<{ apagados: number }> {
  if (confirmacao.trim() !== CONFIRMACAO_DE_ESVAZIAR_FUNIL) {
    throw new Error("Digite ZERAR para esvaziar o funil.");
  }

  let apagados = 0;
  let ultimoId = "";
  for (;;) {
    const { data, error } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("organization_id", organizationId)
      .limit(200);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    const ids = data.map((r) => r.id as string);
    if (ids[0] === ultimoId) {
      throw new Error("Não consegui apagar os cards do funil.");
    }
    ultimoId = ids[0] ?? "";

    const { error: delErr, count } = await supabase
      .from("crm_leads")
      .delete({ count: "exact" })
      .in("id", ids)
      .eq("organization_id", organizationId);
    if (delErr) throw new Error(delErr.message);
    apagados += count ?? ids.length;
  }

  return { apagados };
}
