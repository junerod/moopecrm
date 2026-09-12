import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ganho/perdido: a obrigação comercial pendente não pode sobreviver ao negócio.
 * Zera proximo_passo das demandas abertas daquele lead (e do contato, se o
 * lead_id estiver vazio — inbound antigo).
 */
export async function limparProximoPassoAoEncerrar(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    leadId: string;
    contactId?: string | null;
    reason: "won" | "lost";
  },
): Promise<number> {
  const agora = new Date().toISOString();
  let q = admin
    .from("demandas")
    .update({
      proximo_passo: null,
      proximo_passo_em: null,
      updated_at: agora,
    })
    .eq("organization_id", args.organizationId)
    .is("fechada_em", null)
    .not("proximo_passo", "is", null);

  if (args.contactId) {
    q = q.or(`lead_id.eq.${args.leadId},contact_id.eq.${args.contactId}`);
  } else {
    q = q.eq("lead_id", args.leadId);
  }

  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
