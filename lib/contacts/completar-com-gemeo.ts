/**
 * Completa o que falta no stub @lid com o cadastro que JÁ TEM nome.
 *
 * A RPC não funde (irreversível, tempo da máquina). Quem mostra a pessoa
 * na tela — Inbox, Radar, Cases, Agenda, Follow-ups — precisa do mesmo
 * cruzamento, senão Contatos diz João e o resto diz “Sem nome”.
 *
 * Só preenche a RESPOSTA. Não grava no banco.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  temNomeApresentavel,
  telefoneApresentavel,
  type ContatoNomeavel,
} from "@/lib/contacts/rotulo-do-contato";

type SB = SupabaseClient;

type Gemeo = {
  id: string;
  phone_number: string | null;
  display_name: string | null;
  name: string | null;
};

/** Colunas que `rotuloDoContato` + o cruzamento do gêmeo precisam. */
export const COLUNAS_DO_ROTULO = "id, display_name, name, phone_number, source_metadata";

export async function completarContatosComGemeo<T extends ContatoNomeavel>(
  supabase: SB,
  organizationId: string,
  contatos: T[],
): Promise<T[]> {
  const tels = new Set<string>();
  for (const c of contatos) {
    if (temNomeApresentavel(c)) continue;
    const tel = telefoneApresentavel(c);
    if (tel) tels.add(tel);
  }
  if (tels.size === 0) return contatos;

  const { data, error } = await supabase
    .from("contacts")
    .select("id, phone_number, display_name, name")
    .eq("organization_id", organizationId)
    .in("phone_number", [...tels])
    .is("is_merged_into", null);

  if (error || !data) return contatos;

  const porTel = new Map<string, Gemeo>();
  for (const row of data as Gemeo[]) {
    if (row.phone_number) porTel.set(row.phone_number, row);
  }

  return contatos.map((contato) => {
    if (temNomeApresentavel(contato)) return contato;
    const tel = telefoneApresentavel(contato);
    const gemeo = tel ? porTel.get(tel) : undefined;
    if (!gemeo || gemeo.id === contato.id) {
      return tel && !contato.phone_number ? { ...contato, phone_number: tel } : contato;
    }
    return {
      ...contato,
      display_name: contato.display_name ?? gemeo.display_name,
      name: contato.name ?? gemeo.name,
      phone_number: contato.phone_number ?? tel,
    };
  });
}
