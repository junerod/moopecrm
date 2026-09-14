/**
 * Fail-closed da campanha comercial.
 *
 * Reusa a mesma guarda de automação (`checarGuardasDeContato`): bloqueado,
 * recusa de marketing (`declined_at`). Campanha NÃO envia para bloqueado
 * mesmo se o segmento pedir. Canal decide se falta telefone ou e-mail.
 */
import { checarGuardasDeContato } from "@/lib/automation/guarda-do-contato";
import type { CanalDaCampanha, ContatoParaSegmento } from "@/lib/campanhas/tipos";

export type MotivoDePulo =
  | "contact_blocked"
  | "consent_declined"
  | "no_phone"
  | "no_email"
  | "no_contact"
  | "no_channel"
  | "anonymized"
  | "merged";

export function destinatarioPodeReceberCampanha(contato: ContatoParaSegmento | null | undefined):
  | { ok: true; phone: string }
  | { ok: false; reason: MotivoDePulo } {
  const guarda = checarGuardasDeContato({
    context: { contact: contato ?? undefined },
  } as never);
  if (!guarda.ok) return { ok: false, reason: guarda.reason };
  return { ok: true, phone: guarda.contact.phone_number };
}

export function destinatarioPodeReceberNoCanal(
  contato: ContatoParaSegmento | null | undefined,
  canal: CanalDaCampanha,
): { ok: true; destination: string } | { ok: false; reason: MotivoDePulo } {
  if (!contato) return { ok: false, reason: "no_contact" };
  if (contato.is_blocked) return { ok: false, reason: "contact_blocked" };
  if (contato.consent?.marketing?.declined_at) {
    return { ok: false, reason: "consent_declined" };
  }

  if (canal === "whatsapp") {
    const phone = (contato.phone_number ?? "").trim();
    if (!phone) return { ok: false, reason: "no_phone" };
    return { ok: true, destination: phone };
  }

  const email = (contato.email ?? "").trim();
  if (!email || !email.includes("@")) return { ok: false, reason: "no_email" };
  return { ok: true, destination: email };
}

export function ehOptOut(reason: string | null | undefined): boolean {
  return reason === "consent_declined";
}
