/**
 * Casa locatário da MOOPE com a ficha do CRM — inclusive o nono dígito BR.
 *
 * Não funde cadastro (irreversível). Transfere `moope_external_id` para o
 * contato que o WhatsApp já conhece. Não reescreve telefone nem nome
 * apresentável do fio.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { phoneLookupVariants, samePhone } from "@/lib/channels/phone-variants";
import { temNomeApresentavel } from "@/lib/contacts/rotulo-do-contato";
import { parseDialablePhone } from "@/lib/messaging/contact-card";
import { telefoneE164 } from "@/lib/moope/telefone";
import type { PessoaDoParceiro } from "@/lib/moope/tipos";

export const COLUNAS_PESSOA =
  "id, display_name, name, phone_number, email, source, source_metadata, wa_identity, wa_lid, is_merged_into";

export type FichaContato = {
  id: string;
  display_name: string | null;
  name: string | null;
  phone_number: string | null;
  email: string | null;
  source: string | null;
  source_metadata: Record<string, unknown> | null;
  wa_identity: string | null;
  wa_lid: string | null;
  is_merged_into: string | null;
};

export function variantesDeTelefone(...brutos: Array<string | null | undefined>): string[] {
  const vistos = new Set<string>();
  for (const bruto of brutos) {
    if (!bruto) continue;
    const e164 = parseDialablePhone(bruto);
    for (const v of phoneLookupVariants(e164 ?? bruto)) vistos.add(v);
  }
  return [...vistos];
}

/** Linked ID de verdade — `phone:+55…` não conta. */
export function temLidWhatsapp(c: {
  wa_lid?: string | null;
  wa_identity?: string | null;
}): boolean {
  return Boolean(c.wa_lid) || Boolean(c.wa_identity?.startsWith("lid:"));
}

type FichaDeDestino = {
  phone_number?: string | null;
  wa_lid?: string | null;
  wa_identity?: string | null;
  is_merged_into?: string | null;
};

/**
 * Gêmeo com LID da mesma pessoa (nono dígito) vence.
 * Sem LID, só a ficha do telefone pedido — não a variante sem o 9.
 * Sem os dois, null: quem chama cria a ficha com o número recebido.
 */
export function escolherFichaDoTelefone<T extends FichaDeDestino>(
  candidatos: T[],
  telefonePedido: string,
): T | null {
  const vivos = candidatos.filter((c) => !c.is_merged_into);
  if (vivos.length === 0) return null;
  const pedido = telefoneE164(telefonePedido) ?? telefonePedido;
  const comLid = vivos.find(
    (c) => temLidWhatsapp(c) && (!c.phone_number || samePhone(c.phone_number, pedido)),
  );
  if (comLid) return comLid;
  return vivos.find((c) => c.phone_number === pedido) ?? null;
}

/** Fio com LID vence a ficha que a locadora criou com o 9. Sem LID, o telefone do POST. */
export function escolherDestinoDaPessoa(
  candidatos: FichaContato[],
  telefonePedido?: string,
): FichaContato | null {
  const vivos = candidatos.filter((c) => !c.is_merged_into);
  if (vivos.length === 0) return null;
  if (telefonePedido) return escolherFichaDoTelefone(vivos, telefonePedido);
  return vivos.find((c) => temLidWhatsapp(c)) ?? vivos[0] ?? null;
}

export function patchDaPessoa(
  destino: FichaContato,
  pessoa: PessoaDoParceiro,
): Record<string, unknown> {
  const nomeLocadora = pessoa.name?.trim() || "";
  const meta = {
    ...(destino.source_metadata ?? {}),
    moope_external_id: pessoa.external_id,
    ...(nomeLocadora ? { moope_name: nomeLocadora } : {}),
    ...(pessoa.metadata ?? {}),
  };
  const patch: Record<string, unknown> = { source_metadata: meta };
  if (destino.source !== "whatsapp") patch.source = "moope";
  if (nomeLocadora && !temNomeApresentavel(destino)) {
    patch.display_name = nomeLocadora;
    patch.name = nomeLocadora;
  }
  if (pessoa.phone && !destino.phone_number) patch.phone_number = pessoa.phone;
  if (pessoa.email && !destino.email) patch.email = pessoa.email;
  return patch;
}

export async function upsertPessoa(
  admin: SupabaseClient,
  orgId: string,
  pessoa: PessoaDoParceiro,
): Promise<string | null> {
  if (!pessoa.external_id) return null;

  const candidatos = await listarCandidatos(admin, orgId, pessoa);
  const destino = escolherDestinoDaPessoa(candidatos, pessoa.phone);

  if (!destino) {
    const nome = pessoa.name?.trim() || "Contato MOOPE";
    const { data: criado, error } = await admin
      .from("contacts")
      .insert({
        organization_id: orgId,
        name: nome,
        display_name: nome,
        phone_number: pessoa.phone ?? null,
        email: pessoa.email ?? null,
        source: "moope",
        source_metadata: {
          moope_external_id: pessoa.external_id,
          ...(pessoa.name?.trim() ? { moope_name: pessoa.name.trim() } : {}),
          ...(pessoa.metadata ?? {}),
        },
        tags: [],
      } as never)
      .select("id")
      .single();
    if (error || !criado) return null;
    return (criado as { id: string }).id;
  }

  const patch = patchDaPessoa(destino, pessoa);
  if (typeof patch.email === "string") {
    const { data: emailAlheio } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("email", patch.email)
      .is("is_merged_into", null);
    const conflito = ((emailAlheio as Array<{ id: string }> | null) ?? []).some((r) => r.id !== destino.id);
    if (conflito) delete patch.email;
  }
  const { error: updErr } = await admin
    .from("contacts")
    .update(patch as never)
    .eq("id", destino.id)
    .eq("organization_id", orgId);
  if (updErr) return null;
  await tirarIdDosOutros(admin, orgId, pessoa.external_id, destino.id);
  return destino.id;
}

/**
 * Reaponta `moope_external_id` das fichas desta org para o gêmeo com LID.
 * A locadora chama depois de um lote de `person.upserted`, ou sozinha.
 */
export async function reconciliarGemeosMoope(
  admin: SupabaseClient,
  orgId: string,
): Promise<{ total: number; ajustados: number }> {
  const { data } = await admin
    .from("contacts")
    .select(COLUNAS_PESSOA)
    .eq("organization_id", orgId)
    .not("source_metadata->>moope_external_id", "is", null)
    .is("is_merged_into", null);

  const fichas = ((data as FichaContato[] | null) ?? []).filter(
    (c) => typeof c.source_metadata?.moope_external_id === "string",
  );
  let ajustados = 0;
  const vistos = new Set<string>();
  for (const ficha of fichas) {
    const ext = String(ficha.source_metadata?.moope_external_id);
    if (vistos.has(ext)) continue;
    vistos.add(ext);
    const id = await upsertPessoa(admin, orgId, {
      external_id: ext,
      name: typeof ficha.source_metadata?.moope_name === "string"
        ? String(ficha.source_metadata.moope_name)
        : ficha.display_name ?? ficha.name ?? undefined,
      phone: ficha.phone_number ?? undefined,
      email: ficha.email ?? undefined,
    });
    if (id && id !== ficha.id) ajustados += 1;
  }
  return { total: vistos.size, ajustados };
}

async function listarCandidatos(
  admin: SupabaseClient,
  orgId: string,
  pessoa: PessoaDoParceiro,
): Promise<FichaContato[]> {
  const porId = new Map<string, FichaContato>();

  const { data: porMeta } = await admin
    .from("contacts")
    .select(COLUNAS_PESSOA)
    .eq("organization_id", orgId)
    .eq("source_metadata->>moope_external_id", pessoa.external_id)
    .is("is_merged_into", null);
  for (const row of (porMeta as FichaContato[] | null) ?? []) porId.set(row.id, row);

  const variantes = variantesDeTelefone(
    pessoa.phone,
    ...[...porId.values()].map((c) => c.phone_number),
  );
  if (variantes.length > 0) {
    const { data: porFone } = await admin
      .from("contacts")
      .select(COLUNAS_PESSOA)
      .eq("organization_id", orgId)
      .in("phone_number", variantes)
      .is("is_merged_into", null);
    for (const row of (porFone as FichaContato[] | null) ?? []) porId.set(row.id, row);
  }

  if (porId.size === 0 && pessoa.email) {
    const { data: porEmail } = await admin
      .from("contacts")
      .select(COLUNAS_PESSOA)
      .eq("organization_id", orgId)
      .eq("email", pessoa.email)
      .is("is_merged_into", null);
    for (const row of (porEmail as FichaContato[] | null) ?? []) porId.set(row.id, row);
  }

  return [...porId.values()];
}

async function tirarIdDosOutros(
  admin: SupabaseClient,
  orgId: string,
  externalId: string,
  destinoId: string,
): Promise<void> {
  const { data } = await admin
    .from("contacts")
    .select("id, source_metadata")
    .eq("organization_id", orgId)
    .eq("source_metadata->>moope_external_id", externalId);
  const outros = ((data as Array<{ id: string; source_metadata: Record<string, unknown> | null }> | null) ?? []).filter(
    (row) => row.id !== destinoId,
  );
  for (const row of outros) {
    const { moope_external_id: _drop, ...resto } = row.source_metadata ?? {};
    await admin
      .from("contacts")
      .update({ source_metadata: resto } as never)
      .eq("id", row.id)
      .eq("organization_id", orgId);
  }
}
