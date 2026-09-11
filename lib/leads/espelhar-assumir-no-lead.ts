import type { SupabaseClient } from "@supabase/supabase-js";

import { listarLeadsAbertosDoContato } from "./leads-abertos-do-contato";
import { logger } from "@/lib/logger";

export type EspelhoAssumir =
  | { aplicado: false; motivo: "sem_contato" | "nenhum" | "varios" | "ja_tem_humano" | "dono_agente" }
  | { aplicado: true; leadId: string };

/**
 * Assumir a CONVERSA não é transferir o NEGÓCIO.
 *
 * Só preenche `owner_user_id` quando há exatamente um lead OPEN e ele está
 * sem dono humano e sem dono agente. Dois abertos: não escolhe. Humano já
 * dono: não sobrescreve. Agente dono: não apaga `owner_agent_id`.
 */
export async function espelharAssumirNoLeadAberto(
  db: SupabaseClient,
  args: { organizationId: string; contactId: string | null | undefined; userId: string },
): Promise<EspelhoAssumir> {
  if (!args.contactId) return { aplicado: false, motivo: "sem_contato" };

  const abertos = await listarLeadsAbertosDoContato(db, {
    organizationId: args.organizationId,
    contactId: args.contactId,
  });

  if (abertos.length === 0) return { aplicado: false, motivo: "nenhum" };
  if (abertos.length > 1) return { aplicado: false, motivo: "varios" };

  const lead = abertos[0]!;
  if (lead.owner_user_id) return { aplicado: false, motivo: "ja_tem_humano" };
  if (lead.owner_agent_id) return { aplicado: false, motivo: "dono_agente" };

  const agora = new Date().toISOString();
  const { error } = await db
    .from("crm_leads")
    .update({
      owner_user_id: args.userId,
      owner_agent_id: null,
      owner_kind: "user",
      assigned_at: agora,
      updated_at: agora,
    })
    .eq("organization_id", args.organizationId)
    .eq("id", lead.id)
    .is("owner_user_id", null)
    .is("owner_agent_id", null);

  if (error) {
    logger.warn("espelhar-assumir: não gravou owner do lead", {
      organization_id: args.organizationId,
      lead_id: lead.id,
      detail: error.message.slice(0, 120),
    });
    return { aplicado: false, motivo: "nenhum" };
  }

  return { aplicado: true, leadId: lead.id };
}
