/**
 * Leituras que o parceiro pede com a chave mop_.
 *
 * Service role bypassa RLS: toda query filtra organization_id, e esse id
 * veio da chave, nunca do query string. Leitura não audita.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { rotuloDoContato, SEM_NOME } from "@/lib/contacts/rotulo-do-contato";
import { listarProximasAcoes, type VisaoDaAcao } from "@/lib/demandas/listar-proximas-acoes";
import {
  donoDaLeitura,
  idExternoDoContato,
  LIMITE_DE_COMPROMISSOS,
  montarFunil,
  projetarPulso,
  type AcaoPublica,
  type CompromissoPublico,
  type FunilPublico,
  type LeadPublico,
  type PulsoPublico,
} from "@/lib/moope/leitura";
import { carregarKpisDeSupervisao } from "@/lib/supervisao/kpis";
import { janelaDoPeriodo, type PeriodoPronto } from "@/lib/supervisao/periodo";

type AtorMinimo = { gestor: boolean; userId: string };

const PAGINA = 1000;
const TETO_DE_PAGINAS = 5;

function nomePublico(displayName: string | null, name: string | null): string | null {
  const rotulo = rotuloDoContato({ display_name: displayName, name });
  return rotulo === SEM_NOME ? null : rotulo;
}

async function fichaDosContatos(
  db: SupabaseClient,
  orgId: string,
  ids: string[],
): Promise<Map<string, { externalId: string | null; nome: string | null }>> {
  const mapa = new Map<string, { externalId: string | null; nome: string | null }>();
  if (ids.length === 0) return mapa;
  const { data, error } = await db
    .from("contacts")
    .select("id, display_name, name, source_metadata")
    .eq("organization_id", orgId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const c of data ?? []) {
    mapa.set(String(c.id), {
      externalId: idExternoDoContato(c.source_metadata),
      nome: nomePublico(c.display_name, c.name),
    });
  }
  return mapa;
}

export async function compromissosDoParceiro(
  db: SupabaseClient,
  orgId: string,
  ator: AtorMinimo,
  de: string,
  ate: string,
): Promise<CompromissoPublico[]> {
  let q = db
    .from("calendar_appointments")
    .select("id, title, starts_at, ends_at, status, contact_id, event_type_id")
    .eq("organization_id", orgId)
    .gte("starts_at", de)
    .lt("starts_at", ate)
    .in("status", ["pending", "confirmed", "completed"])
    .order("starts_at", { ascending: true })
    .limit(LIMITE_DE_COMPROMISSOS);

  const dono = donoDaLeitura(ator);
  if (dono) q = q.eq("owner_user_id", dono);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const linhas = data ?? [];

  const tipoIds = [...new Set(linhas.map((l) => l.event_type_id).filter((id): id is string => !!id))];
  const contatoIds = [...new Set(linhas.map((l) => l.contact_id).filter((id): id is string => !!id))];

  const [{ data: tipos, error: erroTipos }, contatos] = await Promise.all([
    tipoIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : db
          .from("calendar_event_types")
          .select("id, name")
          .eq("organization_id", orgId)
          .in("id", tipoIds),
    fichaDosContatos(db, orgId, contatoIds),
  ]);
  if (erroTipos) throw new Error(erroTipos.message);

  const nomeDoTipo = new Map((tipos ?? []).map((t) => [String(t.id), String(t.name)]));

  return linhas.map((l) => {
    const contato = l.contact_id ? contatos.get(String(l.contact_id)) : undefined;
    return {
      id: String(l.id),
      title: (l.title ?? "").trim() || "Compromisso",
      event_type: l.event_type_id ? (nomeDoTipo.get(String(l.event_type_id)) ?? null) : null,
      starts_at: String(l.starts_at),
      ends_at: String(l.ends_at),
      status: String(l.status),
      contact_external_id: contato?.externalId ?? null,
      contact_name: contato?.nome ?? null,
    };
  });
}

export async function acoesDoParceiro(
  db: SupabaseClient,
  orgId: string,
  ator: AtorMinimo,
  visao: Extract<VisaoDaAcao, "hoje" | "proximos" | "atrasados">,
): Promise<AcaoPublica[]> {
  const linhas = await listarProximasAcoes(db, {
    organizationId: orgId,
    visao,
    ownerUserId: donoDaLeitura(ator),
  });
  const contatos = await fichaDosContatos(
    db,
    orgId,
    [...new Set(linhas.map((l) => l.contact_id))],
  );
  return linhas.map((l) => {
    const contato = contatos.get(l.contact_id);
    return {
      id: l.demanda_id,
      text: l.texto,
      due_at: l.em,
      state: l.estado,
      temperature: l.temperatura,
      contact_external_id: contato?.externalId ?? null,
      contact_name: contato?.nome ?? (l.contact_name === "Contato" ? null : l.contact_name),
      lead_title: l.lead_title,
    };
  });
}

export async function pulsoDoParceiro(
  db: SupabaseClient,
  orgId: string,
  periodo: PeriodoPronto,
  agora = new Date(),
): Promise<PulsoPublico> {
  const { from, to } = janelaDoPeriodo(periodo, agora);
  const [kpis, { data: funis, error }] = await Promise.all([
    carregarKpisDeSupervisao(db, { organizationId: orgId, from, to }),
    db.from("crm_pipelines").select("id, name").eq("organization_id", orgId),
  ]);
  if (error) throw new Error(error.message);
  const nomes = new Map((funis ?? []).map((p) => [String(p.id), String(p.name)]));
  return projetarPulso(periodo, kpis, nomes);
}

export async function leadsDoParceiro(
  db: SupabaseClient,
  orgId: string,
  ator: AtorMinimo,
  args: { limite: number; status: "open" | "won" | "lost" | "all"; contactExternalId: string | null },
): Promise<LeadPublico[]> {
  let contatoFiltrado: string[] | null = null;
  if (args.contactExternalId) {
    const { data, error } = await db
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("source_metadata->>moope_external_id", args.contactExternalId)
      .limit(5);
    if (error) throw new Error(error.message);
    contatoFiltrado = (data ?? []).map((c) => String(c.id));
    if (contatoFiltrado.length === 0) return [];
  }

  let q = db
    .from("crm_leads")
    .select("id, title, status, value_cents, temperatura, created_at, stage_id, pipeline_id, contact_id")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(args.limite);

  if (args.status !== "all") q = q.eq("status", args.status);
  const dono = donoDaLeitura(ator);
  if (dono) q = q.eq("owner_user_id", dono);
  if (contatoFiltrado) q = q.in("contact_id", contatoFiltrado);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const linhas = data ?? [];

  const stageIds = [...new Set(linhas.map((l) => l.stage_id).filter((id): id is string => !!id))];
  const pipeIds = [...new Set(linhas.map((l) => l.pipeline_id).filter((id): id is string => !!id))];
  const contatoIds = [...new Set(linhas.map((l) => l.contact_id).filter((id): id is string => !!id))];

  const [{ data: etapas, error: e1 }, { data: funis, error: e2 }, contatos] = await Promise.all([
    stageIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : db.from("crm_stages").select("id, name").eq("organization_id", orgId).in("id", stageIds),
    pipeIds.length === 0
      ? Promise.resolve({ data: [], error: null })
      : db.from("crm_pipelines").select("id, name").eq("organization_id", orgId).in("id", pipeIds),
    fichaDosContatos(db, orgId, contatoIds),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const etapa = new Map((etapas ?? []).map((s) => [String(s.id), String(s.name)]));
  const funil = new Map((funis ?? []).map((p) => [String(p.id), String(p.name)]));

  return linhas.map((l) => {
    const contato = l.contact_id ? contatos.get(String(l.contact_id)) : undefined;
    const temperatura = l.temperatura;
    return {
      id: String(l.id),
      title: String(l.title),
      status: String(l.status),
      stage_name: l.stage_id ? (etapa.get(String(l.stage_id)) ?? null) : null,
      pipeline_name: l.pipeline_id ? (funil.get(String(l.pipeline_id)) ?? null) : null,
      value_cents: l.value_cents,
      temperature:
        temperatura === "frio" || temperatura === "morno" || temperatura === "quente"
          ? temperatura
          : null,
      created_at: String(l.created_at),
      contact_external_id: contato?.externalId ?? null,
      contact_name: contato?.nome ?? null,
    };
  });
}

async function contar(
  db: SupabaseClient,
  orgId: string,
  pipelineId: string,
  status: "won" | "lost",
): Promise<number> {
  const { count, error } = await db
    .from("crm_leads")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("pipeline_id", pipelineId)
    .eq("status", status);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function funilDoParceiro(db: SupabaseClient, orgId: string): Promise<FunilPublico> {
  const [{ data: pipelines, error: e1 }, { data: stages, error: e2 }] = await Promise.all([
    db
      .from("crm_pipelines")
      .select("id, name, position")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
    db
      .from("crm_stages")
      .select("id, name, pipeline_id, position, is_won, is_lost")
      .eq("organization_id", orgId)
      .eq("is_archived", false),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const abertos: Array<{ stage_id: string; pipeline_id: string; value_cents: number | null }> = [];
  let truncated = false;
  for (let pagina = 0; pagina < TETO_DE_PAGINAS; pagina += 1) {
    const { data, error } = await db
      .from("crm_leads")
      .select("stage_id, pipeline_id, value_cents")
      .eq("organization_id", orgId)
      .eq("status", "open")
      .range(pagina * PAGINA, pagina * PAGINA + PAGINA - 1);
    if (error) throw new Error(error.message);
    const lote = data ?? [];
    for (const l of lote) {
      if (!l.stage_id || !l.pipeline_id) continue;
      abertos.push({
        stage_id: String(l.stage_id),
        pipeline_id: String(l.pipeline_id),
        value_cents: l.value_cents,
      });
    }
    if (lote.length < PAGINA) break;
    if (pagina === TETO_DE_PAGINAS - 1) truncated = true;
  }

  const pipes = (pipelines ?? []).map((p) => ({
    id: String(p.id),
    name: String(p.name),
    position: Number(p.position ?? 0),
  }));

  const fechados = await Promise.all(
    pipes.map(async (p) => ({
      pipeline_id: p.id,
      won: await contar(db, orgId, p.id, "won"),
      lost: await contar(db, orgId, p.id, "lost"),
    })),
  );

  return montarFunil(
    pipes,
    (stages ?? []).map((s) => ({
      id: String(s.id),
      name: String(s.name),
      pipeline_id: String(s.pipeline_id),
      position: Number(s.position ?? 0),
      is_won: Boolean(s.is_won),
      is_lost: Boolean(s.is_lost),
    })),
    abertos,
    fechados,
    truncated,
  );
}
