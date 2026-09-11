import type { SupabaseClient } from "@supabase/supabase-js";

import { listarLeadsAbertosDoContato } from "./leads-abertos-do-contato";

export type ReconciliacaoNascimento =
  | { manteve: true; leadId: string }
  | { manteve: false; leadId: string };

/**
 * Depois de um INSERT de nascimento (ingest ou "Adicionar ao funil"), se outro
 * lead OPEN mais antigo apareceu na corrida, este card é o acidental.
 *
 * Apaga SÓ o que acabamos de criar. Não toca em oportunidade mais antiga — é
 * ela que já existia ou que venceu a corrida. Dois negócios legítimos criados
 * pelo caminho "criar outra" não passam por aqui.
 */
export async function reconciliarNascimentoAberto(
  db: SupabaseClient,
  args: { organizationId: string; contactId: string; leadIdCriado: string },
): Promise<ReconciliacaoNascimento> {
  const abertos = await listarLeadsAbertosDoContato(db, {
    organizationId: args.organizationId,
    contactId: args.contactId,
  });
  const maisAntigo = abertos[0];
  if (!maisAntigo || maisAntigo.id === args.leadIdCriado) {
    return { manteve: true, leadId: args.leadIdCriado };
  }

  const { error } = await db
    .from("crm_leads")
    .delete()
    .eq("organization_id", args.organizationId)
    .eq("id", args.leadIdCriado)
    .eq("contact_id", args.contactId)
    .eq("status", "open");

  if (error) throw new Error(error.message);
  return { manteve: false, leadId: maisAntigo.id };
}
