/**
 * Resposta à campanha entra na Inbox normal.
 * Aqui só marcamos origem no destinatário — sem inbox paralela e sem criar lead.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { destinatarioJaEnviado } from "@/lib/campanhas/transicoes";

export async function marcarRespostaDaCampanha(
  db: SupabaseClient,
  entrada: {
    organizationId: string;
    contactId: string;
    inboundAt?: string;
    leadId?: string | null;
  },
): Promise<{ campaign_id: string; recipient_id: string } | null> {
  try {
    const { data } = await db
      .from("campaign_recipients")
      .select("id, campaign_id, status, replied_at, lead_id")
      .eq("organization_id", entrada.organizationId)
      .eq("contact_id", entrada.contactId)
      .order("sent_at", { ascending: false })
      .limit(8);

    const rows = (data ?? []) as Array<{
      id: string;
      campaign_id: string;
      status: string;
      replied_at: string | null;
      lead_id: string | null;
    }>;
    const alvo = rows.find((r) => destinatarioJaEnviado(r.status as never) || r.status === "sent");
    if (!alvo) return null;

    const agora = entrada.inboundAt ?? new Date().toISOString();
    await db
      .from("campaign_recipients")
      .update({
        status: "replied",
        replied_at: alvo.replied_at ?? agora,
        lead_id: entrada.leadId ?? alvo.lead_id,
      })
      .eq("id", alvo.id)
      .eq("organization_id", entrada.organizationId);

    return { campaign_id: alvo.campaign_id, recipient_id: alvo.id };
  } catch {
    return null;
  }
}

export async function campanhaDeOrigemDoContato(
  db: SupabaseClient,
  entrada: { organizationId: string; contactId: string },
): Promise<string | null> {
  try {
    // Sem `.not()`: o adaptador de `test:db` (`pgComoSupabase`) não o implementa,
    // e nascimentos de lead não podem estourar por atribuição de campanha.
    const { data } = await db
      .from("campaign_recipients")
      .select("campaign_id, sent_at, status")
      .eq("organization_id", entrada.organizationId)
      .eq("contact_id", entrada.contactId)
      .order("sent_at", { ascending: false })
      .limit(8);
    const rows = (data ?? []) as Array<{
      campaign_id: string;
      sent_at: string | null;
      status: string;
    }>;
    const alvo = rows.find((r) => r.sent_at && (destinatarioJaEnviado(r.status as never) || r.status === "sent"));
    return alvo?.campaign_id ?? null;
  } catch {
    return null;
  }
}
