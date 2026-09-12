import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Um próximo passo comercial: texto + quando, na demanda aberta do contato.
 *
 * Se já existe demanda aberta, edita. Se não, abre uma com a mesma semântica
 * do trigger de inbound (`origem` no vocabulário existente; aqui `manual`
 * porque o humano marcou na ficha, não uma mensagem nova).
 */
export async function definirProximoPassoComercial(
  admin: SupabaseClient,
  args: {
    organizationId: string;
    contactId: string;
    conversationId?: string | null;
    userId: string;
    proximo_passo: string;
    proximo_passo_em: string | null;
    leadId?: string | null;
  },
): Promise<{ demanda_id: string; proximo_passo: string; proximo_passo_em: string | null }> {
  const agora = new Date().toISOString();

  const { data: existente, error: erroLeitura } = await admin
    .from("demandas")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("contact_id", args.contactId)
    .is("fechada_em", null)
    .order("aberta_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (erroLeitura) throw new Error(erroLeitura.message);

  let demandaId = existente?.id as string | undefined;

  if (!demandaId) {
    const { data: criada, error: erroInsert } = await admin
      .from("demandas")
      .insert({
        organization_id: args.organizationId,
        contact_id: args.contactId,
        lead_id: args.leadId ?? null,
        origem: "manual",
        estado: "em_atendimento",
        dono_kind: "humano",
        dono_user_id: args.userId,
        proximo_passo: args.proximo_passo,
        proximo_passo_em: args.proximo_passo_em,
        updated_at: agora,
      })
      .select("id")
      .single();

    if (erroInsert || !criada) {
      throw new Error(erroInsert?.message ?? "Falha ao abrir demanda.");
    }
    demandaId = criada.id as string;

    if (args.conversationId) {
      await admin.from("demanda_conversas").insert({
        organization_id: args.organizationId,
        demanda_id: demandaId,
        conversation_id: args.conversationId,
      });
      // vínculo duplicado é inofensivo — a demanda já está gravada
    }
  } else {
    const { error: erroPatch } = await admin
      .from("demandas")
      .update({
        proximo_passo: args.proximo_passo,
        proximo_passo_em: args.proximo_passo_em,
        dono_kind: "humano",
        dono_user_id: args.userId,
        ...(args.leadId ? { lead_id: args.leadId } : {}),
        updated_at: agora,
      })
      .eq("id", demandaId)
      .eq("organization_id", args.organizationId)
      .is("fechada_em", null);

    if (erroPatch) throw new Error(erroPatch.message);
  }

  return {
    demanda_id: demandaId,
    proximo_passo: args.proximo_passo,
    proximo_passo_em: args.proximo_passo_em,
  };
}
