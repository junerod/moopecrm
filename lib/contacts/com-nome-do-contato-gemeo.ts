/**
 * Completa o rótulo da conversa com o cadastro que JÁ TEM nome.
 *
 * Quando o WhatsApp chega como `@lid` e o telefone descoberto já pertence a
 * outro contato da org (MOOPE, import, formulário), a RPC grava o número em
 * `source_metadata.telefone_em_conflito` e recusa fundir — fusão é
 * irreversível e não acontece no tempo da máquina. O Inbox, porém, liga a
 * conversa ao stub sem nome, e Contatos mostra a pessoa certa. Sem este
 * passo as duas telas mentem uma para a outra.
 *
 * Só preenche o que falta na RESPOSTA. Não grava no banco.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { completarContatosComGemeo } from "@/lib/contacts/completar-com-gemeo";
import { contatoDoEmbed, type ContatoNomeavel } from "@/lib/contacts/rotulo-do-contato";

type SB = SupabaseClient;

type EmbedDeContato = ContatoNomeavel | ContatoNomeavel[] | null | undefined;

function embedDaConversa(c: object): EmbedDeContato {
  if (!("contacts" in c)) return undefined;
  return (c as { contacts?: EmbedDeContato }).contacts;
}

export async function comNomeDoContatoGemeo<T extends object>(
  supabase: SB,
  organizationId: string,
  conversas: T[],
): Promise<T[]> {
  const comEmbedResolvido = conversas.map((c) => ({
    ...c,
    contacts: contatoDoEmbed(embedDaConversa(c) ?? null),
  }));

  const brutos = comEmbedResolvido
    .map((c) => c.contacts)
    .filter((c): c is ContatoNomeavel => c !== null);
  const completos = await completarContatosComGemeo(supabase, organizationId, brutos);
  const porId = new Map(
    completos.filter((c) => c.id).map((c) => [c.id as string, c]),
  );

  return comEmbedResolvido.map((c) => {
    const contato = c.contacts;
    if (!contato?.id) return c;
    const resolvido = porId.get(contato.id);
    return resolvido ? { ...c, contacts: resolvido } : c;
  });
}
