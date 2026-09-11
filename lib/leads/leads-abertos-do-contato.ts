import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Leads OPEN de um contato — a pergunta da ficha da Inbox.
 *
 * Não escolhe um. `resolveActiveLeadForContact` existe para a IA e, em empate
 * com atividade distinta, roteia. A ficha comercial NÃO pode herdar isso:
 * dois negócios abertos exigem o humano apontar qual opera.
 */
export interface LeadAbertoResumo {
  id: string;
  created_at: string;
  owner_user_id: string | null;
  owner_agent_id: string | null;
}

export async function listarLeadsAbertosDoContato(
  db: SupabaseClient,
  args: { organizationId: string; contactId: string },
): Promise<LeadAbertoResumo[]> {
  const { data, error } = await db
    .from("crm_leads")
    .select("id, created_at, owner_user_id, owner_agent_id")
    .eq("organization_id", args.organizationId)
    .eq("contact_id", args.contactId)
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as LeadAbertoResumo[];
}
