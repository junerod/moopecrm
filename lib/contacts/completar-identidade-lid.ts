/**
 * Telefone por trás de um stub @lid — só na RESPOSTA, sem gravar.
 *
 * O WhatsApp entrega um id opaco; o número mora na tabela de tradução do
 * canal, povoada por atividade. Sem isto, a ficha do contato que o
 * atendente acaba de abrir mostra travessão em nome e telefone mesmo
 * quando o aparelho já sabe o número.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  temNomeApresentavel,
  telefoneApresentavel,
  type ContatoNomeavel,
} from "@/lib/contacts/rotulo-do-contato";

type SB = SupabaseClient;

export function lidDoContato(c: {
  wa_lid?: string | null;
  source_metadata?: Record<string, unknown> | null;
}): string | null {
  if (typeof c.wa_lid === "string" && c.wa_lid.trim()) {
    const soDigitos = c.wa_lid.replace(/@lid$/i, "").replace(/\D/g, "");
    return soDigitos.length > 0 ? soDigitos : null;
  }
  const meta = c.source_metadata;
  if (!meta || typeof meta !== "object") return null;
  for (const chave of ["waha_lid", "waha_chat_id"] as const) {
    const v = meta[chave];
    if (typeof v !== "string" || !v.trim()) continue;
    if (v.toLowerCase().endsWith("@lid") || /^\d+$/.test(v)) {
      const soDigitos = v.replace(/@lid$/i, "").replace(/\D/g, "");
      if (soDigitos.length > 0) return soDigitos;
    }
  }
  return null;
}

export async function completarIdentidadeLid<T extends ContatoNomeavel & { id?: string | null }>(
  supabase: SB,
  organizationId: string,
  contato: T,
  resolver: (sessao: string, lid: string) => Promise<string | null>,
): Promise<T> {
  if (temNomeApresentavel(contato) && telefoneApresentavel(contato)) return contato;
  const lid = lidDoContato(contato);
  if (!lid) return contato;

  const sessao = await sessaoDoContato(supabase, organizationId, contato.id ?? null);
  if (!sessao) return contato;

  const tel = await resolver(sessao, lid);
  if (!tel) return contato;

  const meta =
    contato.source_metadata && typeof contato.source_metadata === "object"
      ? { ...contato.source_metadata }
      : {};
  if (!meta.telefone_em_conflito) meta.telefone_em_conflito = tel;

  return {
    ...contato,
    phone_number: contato.phone_number ?? tel,
    source_metadata: meta,
  };
}

async function sessaoDoContato(
  supabase: SB,
  organizationId: string,
  contactId: string | null,
): Promise<string | null> {
  if (contactId) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("channel_session_id")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .limit(1)
      .maybeSingle();
    const sessionId = (conv as { channel_session_id?: string } | null)?.channel_session_id;
    if (sessionId) {
      const { data: canal } = await supabase
        .from("channel_sessions")
        .select("waha_session_name")
        .eq("id", sessionId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      const nome = (canal as { waha_session_name?: string | null } | null)?.waha_session_name;
      if (nome) return nome;
    }
  }

  const { data: qualquer } = await supabase
    .from("channel_sessions")
    .select("waha_session_name")
    .eq("organization_id", organizationId)
    .eq("status", "WORKING")
    .not("waha_session_name", "is", null)
    .limit(1)
    .maybeSingle();
  return (qualquer as { waha_session_name?: string | null } | null)?.waha_session_name ?? null;
}
