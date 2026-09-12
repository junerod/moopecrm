/**
 * Fail-closed da campanha comercial.
 *
 * Reusa a mesma guarda de automação (`checarGuardasDeContato`): bloqueado,
 * sem telefone, recusa de marketing (`declined_at`). Campanha NÃO envia para
 * bloqueado mesmo se o segmento pedir.
 */
import { checarGuardasDeContato } from "@/lib/automation/guarda-do-contato";
import type { ContatoParaSegmento } from "@/lib/campanhas/tipos";

export type MotivoDePulo =
  | "contact_blocked"
  | "consent_declined"
  | "no_phone"
  | "no_contact";

export function destinatarioPodeReceberCampanha(contato: ContatoParaSegmento | null | undefined):
  | { ok: true; phone: string }
  | { ok: false; reason: MotivoDePulo } {
  const guarda = checarGuardasDeContato({
    context: { contact: contato ?? undefined },
  } as never);
  if (!guarda.ok) return { ok: false, reason: guarda.reason };
  return { ok: true, phone: guarda.contact.phone_number };
}
