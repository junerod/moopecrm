import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContatoParaSegmento, SegmentoDaCampanha } from "@/lib/campanhas/tipos";

export async function carregarContatosDoSegmento(
  db: SupabaseClient,
  organizationId: string,
  segmento: SegmentoDaCampanha,
): Promise<ContatoParaSegmento[]> {
  let q = db
    .from("contacts")
    .select("id, display_name, name, phone_number, email, tags, papel, source, is_blocked, consent")
    .eq("organization_id", organizationId)
    .is("is_merged_into", null)
    .eq("is_anonymized", false)
    .limit(5000);

  if (segmento.contact_ids && segmento.contact_ids.length > 0) {
    q = q.in("id", segmento.contact_ids);
  }
  if (segmento.papel) q = q.eq("papel", segmento.papel);
  if (segmento.origem) q = q.eq("source", segmento.origem);
  if (segmento.tags && segmento.tags.length > 0) q = q.overlaps("tags", segmento.tags);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as ContatoParaSegmento[];

  const precisaLead =
    !!segmento.owner_user_id ||
    !!segmento.pipeline_id ||
    !!segmento.stage_id ||
    !!segmento.temperatura;
  if (!precisaLead || rows.length === 0) return rows;

  const ids = rows.map((r) => r.id);
  const { data: leads } = await db
    .from("crm_leads")
    .select("contact_id, owner_user_id, pipeline_id, stage_id, temperatura, status")
    .eq("organization_id", organizationId)
    .eq("status", "open")
    .in("contact_id", ids);

  const porContato = new Map<string, {
    owner_user_id: string | null;
    pipeline_id: string;
    stage_id: string;
    temperatura: string | null;
  }>();
  for (const l of (leads ?? []) as Array<{
    contact_id: string | null;
    owner_user_id: string | null;
    pipeline_id: string;
    stage_id: string;
    temperatura: string | null;
  }>) {
    if (!l.contact_id || porContato.has(l.contact_id)) continue;
    porContato.set(l.contact_id, l);
  }

  return rows.map((c) => {
    const lead = porContato.get(c.id);
    return {
      ...c,
      owner_user_id: lead?.owner_user_id ?? null,
      pipeline_id: lead?.pipeline_id ?? null,
      stage_id: lead?.stage_id ?? null,
      temperatura: lead?.temperatura ?? null,
    };
  });
}
