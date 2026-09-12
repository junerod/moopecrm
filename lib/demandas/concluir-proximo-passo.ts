import type { SupabaseClient } from "@supabase/supabase-js";

import { emitLeadActivity } from "@/lib/leads/activity-emitter";

/**
 * Conclui o compromisso — zera texto/quando. A demanda pode continuar aberta
 * (a conversa não acabou). Win/loss é outro caminho (`limpar-ao-encerrar`).
 */
export async function concluirProximoPassoComercial(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    demandaId: string;
    userId: string;
    userName?: string | null;
  },
): Promise<{ demanda_id: string; texto_anterior: string | null } | null> {
  const { data: atual, error: erroLeitura } = await admin
    .from("demandas")
    .select("id, proximo_passo, lead_id, contact_id")
    .eq("id", args.demandaId)
    .eq("organization_id", args.organizationId)
    .is("fechada_em", null)
    .maybeSingle();
  if (erroLeitura) throw new Error(erroLeitura.message);
  if (!atual) return null;

  const texto = (atual.proximo_passo as string | null) ?? null;
  const { error } = await admin
    .from("demandas")
    .update({
      proximo_passo: null,
      proximo_passo_em: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.demandaId)
    .eq("organization_id", args.organizationId)
    .is("fechada_em", null);
  if (error) throw new Error(error.message);

  if (atual.lead_id && texto) {
    const quem = args.userName?.trim() || "Alguém";
    await emitLeadActivity(admin, {
      organizationId: args.organizationId,
      leadId: atual.lead_id as string,
      contactId: (atual.contact_id as string | null) ?? null,
      type: "proximo_passo_concluido",
      sourceModule: "crm",
      sourceId: args.demandaId,
      actor: { type: "user", id: args.userId },
      reason: `${quem} concluiu: ${texto}`,
      payload: { proximo_passo: texto },
    });
  }

  return { demanda_id: args.demandaId, texto_anterior: texto };
}
