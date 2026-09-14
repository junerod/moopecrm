/**
 * Materializa destinatários em lote. Idempotente via unique (campanha, contato, canal).
 * Nunca roda 5.000 inserts um a um no POST /start.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { rotearContato } from "@/lib/campanhas/canais";
import { lerSettings } from "@/lib/campanhas/settings";
import { estimarSegmento } from "@/lib/campanhas/segmento";
import type {
  CanalDaCampanha,
  ContatoParaSegmento,
  SegmentoDaCampanha,
  SelecaoDeCanais,
} from "@/lib/campanhas/tipos";
import { LOTE_MATERIALIZACAO, canaisDaSelecao } from "@/lib/campanhas/tipos";

export interface LinhaDeDestinatario {
  organization_id: string;
  campaign_id: string;
  contact_id: string;
  channel: CanalDaCampanha;
  destination: string | null;
  phone: string | null;
  status: "pending" | "skipped";
  error: string | null;
}

export function montarLinhasDeDestinatarios(entrada: {
  organizationId: string;
  campaignId: string;
  contatos: ContatoParaSegmento[];
  contactIds: string[];
  selecao: SelecaoDeCanais;
}): LinhaDeDestinatario[] {
  const porId = new Map(entrada.contatos.map((c) => [c.id, c]));
  const linhas: LinhaDeDestinatario[] = [];
  for (const contactId of entrada.contactIds) {
    const contato = porId.get(contactId);
    if (!contato) {
      linhas.push({
        organization_id: entrada.organizationId,
        campaign_id: entrada.campaignId,
        contact_id: contactId,
        channel: canaisDaSelecao(entrada.selecao)[0] ?? "whatsapp",
        destination: null,
        phone: null,
        status: "skipped",
        error: "no_contact",
      });
      continue;
    }
    const rota = rotearContato(contato, entrada.selecao);
    if (rota.ignorado) {
      linhas.push({
        organization_id: entrada.organizationId,
        campaign_id: entrada.campaignId,
        contact_id: contactId,
        channel: canaisDaSelecao(entrada.selecao)[0] ?? "whatsapp",
        destination: null,
        phone: contato.phone_number ?? null,
        status: "skipped",
        error: rota.motivo,
      });
      continue;
    }
    for (const d of rota.destinos) {
      linhas.push({
        organization_id: entrada.organizationId,
        campaign_id: entrada.campaignId,
        contact_id: contactId,
        channel: d.canal,
        destination: d.destination,
        phone: d.canal === "whatsapp" ? d.destination : contato.phone_number ?? null,
        status: "pending",
        error: null,
      });
    }
  }
  return linhas;
}

export async function inserirDestinatariosEmLote(
  db: SupabaseClient,
  linhas: LinhaDeDestinatario[],
): Promise<{ inseridos: number; pulados: number; conflito: number }> {
  let inseridos = 0;
  let pulados = 0;
  let conflito = 0;
  if (linhas.length === 0) return { inseridos, pulados, conflito };

  const { error } = await db.from("campaign_recipients").insert(linhas as never);
  if (!error) {
    for (const l of linhas) {
      if (l.status === "pending") inseridos += 1;
      else pulados += 1;
    }
    return { inseridos, pulados, conflito };
  }
  if (error.code === "23505") {
    // Lote inteiro colidiu ou uma linha — cai no insert unitário idempotente.
    for (const linha of linhas) {
      const r = await db.from("campaign_recipients").insert(linha as never);
      if (r.error?.code === "23505") {
        conflito += 1;
        continue;
      }
      if (r.error) throw r.error;
      if (linha.status === "pending") inseridos += 1;
      else pulados += 1;
    }
    return { inseridos, pulados, conflito };
  }
  throw error;
}

export async function materializarProximoLote(
  db: SupabaseClient,
  entrada: {
    organizationId: string;
    campaignId: string;
    contatos: ContatoParaSegmento[];
    segmento: SegmentoDaCampanha;
    selecao: SelecaoDeCanais;
    lote?: number;
  },
): Promise<{ inseridos: number; pulados: number; concluido: boolean; conflito: number }> {
  const est = estimarSegmento(entrada.contatos, entrada.segmento, entrada.selecao);
  const { data: ja } = await db
    .from("campaign_recipients")
    .select("contact_id")
    .eq("campaign_id", entrada.campaignId)
    .eq("organization_id", entrada.organizationId)
    .limit(5000);
  const feitos = new Set(((ja ?? []) as Array<{ contact_id: string }>).map((r) => r.contact_id));
  const pendentes = est.ids.filter((id) => !feitos.has(id));
  const lote = entrada.lote ?? LOTE_MATERIALIZACAO;
  const fatia = pendentes.slice(0, lote);
  const linhas = montarLinhasDeDestinatarios({
    organizationId: entrada.organizationId,
    campaignId: entrada.campaignId,
    contatos: entrada.contatos,
    contactIds: fatia,
    selecao: entrada.selecao,
  });
  const r = await inserirDestinatariosEmLote(db, linhas);
  return {
    ...r,
    concluido: pendentes.length <= fatia.length,
  };
}

/** Compat: materializa todos os IDs (testes unitários / lotes pequenos). */
export async function materializarDestinatarios(
  db: SupabaseClient,
  entrada: {
    organizationId: string;
    campaignId: string;
    contactIds: string[];
    contatos: ContatoParaSegmento[];
    selecao?: SelecaoDeCanais;
  },
): Promise<{ inseridos: number; pulados: number }> {
  const linhas = montarLinhasDeDestinatarios({
    organizationId: entrada.organizationId,
    campaignId: entrada.campaignId,
    contatos: entrada.contatos,
    contactIds: entrada.contactIds,
    selecao: entrada.selecao ?? "whatsapp",
  });
  const r = await inserirDestinatariosEmLote(db, linhas);
  return { inseridos: r.inseridos, pulados: r.pulados };
}

export function selecaoDosSettings(settingsBruto: unknown): SelecaoDeCanais {
  return lerSettings(settingsBruto).channels ?? "whatsapp";
}
