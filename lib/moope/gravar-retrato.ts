/**
 * Instantâneo do retrato na ficha — o Conversador lê no turno seguinte.
 * Não é mutação de contrato/fatura; é cache do que a locadora já devolveu.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { RetratoLocatario } from "@/lib/moope/cliente-locadora";

export async function gravarRetratoNoContato(
  admin: SupabaseClient,
  orgId: string,
  retrato: RetratoLocatario,
): Promise<void> {
  const { data } = await admin
    .from("contacts")
    .select("id, source_metadata")
    .eq("organization_id", orgId)
    .eq("source_metadata->>moope_external_id", retrato.locatario_id)
    .maybeSingle();
  if (!data) return;
  const atual =
    (data as { id: string; source_metadata?: Record<string, unknown> }).source_metadata ?? {};
  await admin
    .from("contacts")
    .update({
      source_metadata: {
        ...atual,
        moope_external_id: retrato.locatario_id,
        retrato_locadora: {
          nome: retrato.nome,
          placa: retrato.placa,
          contrato_titulo: retrato.contrato_titulo,
          contrato_status: retrato.contrato_status,
          faixa: retrato.faixa,
          amount_cents: retrato.amount_cents,
          days_late: retrato.days_late,
          portal_url: retrato.portal_url,
          boleto_url: retrato.boleto_url,
          invoice_url: retrato.invoice_url,
          lido_em: new Date().toISOString(),
        },
      },
    })
    .eq("id", (data as { id: string }).id)
    .eq("organization_id", orgId);
}
