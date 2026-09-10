import { apiClient } from "@/lib/api/client";
import type { Contact } from "@/lib/types/contacts";
import { normalizePhoneBR } from "@/lib/webhooks/inbound";

interface ListaContatos {
  data: Contact[];
}

interface Criado {
  data: { contact: Contact; action?: string } | Contact;
}

function idDoCriado(body: Criado): string | null {
  const d = body.data;
  if (!d) return null;
  if ("contact" in d && d.contact && typeof d.contact === "object" && "id" in d.contact) {
    return (d.contact as Contact).id;
  }
  if ("id" in d && typeof d.id === "string") return d.id;
  return null;
}

/**
 * Reusa o contato do mesmo telefone ou cria um novo.
 * Evita dois "João Silva" na agenda quando o comercial abre outra oportunidade.
 */
export async function garantirContatoDoLead(opts: {
  nome?: string;
  telefone?: string;
}): Promise<string | null> {
  const nome = opts.nome?.trim() || "";
  const e164 = opts.telefone?.trim() ? normalizePhoneBR(opts.telefone) : null;
  if (!nome && !e164) return null;

  if (e164) {
    const lista = await apiClient.get<ListaContatos>(
      `/api/v1/contacts?search=${encodeURIComponent(e164)}&limit=20`,
    );
    const hit = (lista.data ?? []).find((c) => c.phone_number === e164);
    if (hit) return hit.id;
  }

  const created = await apiClient.post<Criado>("/api/v1/contacts", {
    name: nome || undefined,
    phone_number: e164 ?? undefined,
    source: "manual",
  });
  return idDoCriado(created);
}
