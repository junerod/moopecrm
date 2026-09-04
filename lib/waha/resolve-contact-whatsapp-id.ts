/**
 * Resolve o wa_id canônico para cartão de contato (vcard).
 *
 * No WhatsApp BR o CRM grava +5531998966398 (13 dígitos) mas o wa_id registrado
 * pode ser 553198966398 (12, sem o nono). vCard com waid errado EXIBE o cartão,
 * porém o toque no app nativo não abre a conversa — exatamente o bug reportado.
 *
 * WAHA documenta `GET /api/contacts/check-exists` para isso; tentamos todas as
 * variantes de busca (phoneLookupVariants) antes de cair no número bruto.
 */
import { phoneLookupVariants } from "@/lib/channels/phone-variants";

import type { WahaClient } from "./client";

export interface WahaCheckExistsResult {
  numberExists: boolean;
  chatId?: string | null;
  pn?: string | null;
}

/** Extrai só dígitos do JID retornado (`5531…@c.us` ou `@lid`). */
export function whatsappIdFromCheckResult(r: WahaCheckExistsResult): string | null {
  const raw = r.pn ?? r.chatId;
  if (!raw) return null;
  const user = raw.split("@")[0] ?? "";
  const digits = user.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

/**
 * JID que o transporte deve usar no envio.
 *
 * `chatId` vence `pn`: no BR o WhatsApp devolve o nono canônico em `chatId`
 * (`556196715985@c.us`) mesmo quando o CRM gravou o número com o 9. Mandar no
 * `@c.us` do cadastro faz o canal aceitar (id 3EB0…) e o celular nunca recebe.
 */
export function chatIdFromCheckResult(r: WahaCheckExistsResult): string | null {
  if (r.chatId?.includes("@")) return r.chatId;
  if (r.pn?.includes("@")) return r.pn;
  const digits = whatsappIdFromCheckResult(r);
  return digits ? `${digits}@c.us` : null;
}

export type DestinoCanonico = {
  /** Pelo menos uma variante respondeu sem erro. */
  consultou: boolean;
  existe: boolean;
  chatId: string | null;
};

/**
 * Pergunta ao canal qual JID entrega neste número (variantes do nono dígito).
 * Sem consulta (rede/API fora) → `consultou: false` — quem chama não reescreve.
 */
export async function resolveCanonicalSendChatId(
  client: WahaClient,
  session: string,
  phone: string,
): Promise<DestinoCanonico> {
  const tried = new Set<string>();
  let consultou = false;
  for (const variant of phoneLookupVariants(phone)) {
    const digits = variant.replace(/\D/g, "");
    if (!digits || tried.has(digits)) continue;
    tried.add(digits);
    try {
      const r = await client.checkContactExists(session, digits);
      consultou = true;
      if (r.numberExists) {
        const chatId = chatIdFromCheckResult(r);
        if (chatId) return { consultou: true, existe: true, chatId };
      }
    } catch {
      // próxima variante; se nenhuma responder, quem chama mantém o destino original
    }
  }
  return { consultou, existe: false, chatId: null };
}

/**
 * Destinos de envio, na ordem: JID canônico do canal (se houver), depois
 * cada variante do nono dígito. `@lid` e grupo ficam sozinhos.
 * Quem chama MANDA em todos — um JID some, o outro entrega.
 */
export async function destinosDeEnvioWaha(
  client: WahaClient,
  session: string,
  to: string,
): Promise<string[]> {
  if (!to.endsWith("@c.us")) return [to];
  const digits = to.slice(0, -"@c.us".length).replace(/\D/g, "");
  if (!digits) return [to];
  const phone = `+${digits}`;
  const canon = await resolveCanonicalSendChatId(client, session, phone);
  const vistos = new Set<string>();
  const lista: string[] = [];
  const push = (jid: string) => {
    if (!jid || vistos.has(jid)) return;
    vistos.add(jid);
    lista.push(jid);
  };
  if (canon.chatId) push(canon.chatId);
  push(to);
  for (const v of phoneLookupVariants(phone)) {
    const d = v.replace(/\D/g, "");
    if (d) push(`${d}@c.us`);
  }
  return lista.length > 0 ? lista : [to];
}

/** Primeiro destino (canônico se o canal respondeu). Compatível com quem só manda um. */
export async function destinoDeEnvioWaha(
  client: WahaClient,
  session: string,
  to: string,
): Promise<string> {
  const lista = await destinosDeEnvioWaha(client, session, to);
  return lista[0] ?? to;
}

/** Consulta WAHA; null = não achou ou falhou (caller usa fallback). */
export async function resolveWhatsappIdForContactCard(
  client: WahaClient,
  session: string,
  phone: string,
): Promise<string | null> {
  const tried = new Set<string>();
  for (const variant of phoneLookupVariants(phone)) {
    const digits = variant.replace(/\D/g, "");
    if (!digits || tried.has(digits)) continue;
    tried.add(digits);
    try {
      const r = await client.checkContactExists(session, digits);
      if (r.numberExists) {
        const id = whatsappIdFromCheckResult(r);
        if (id) return id;
      }
    } catch {
      // ponytail: falha na consulta não bloqueia envio — adapter cai no wa_id bruto
    }
  }
  return null;
}
