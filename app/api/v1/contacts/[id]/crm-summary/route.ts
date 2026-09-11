/**
 * GET /api/v1/contacts/[id]/crm-summary — o resumo de CRM do painel do inbox.
 *
 * POR QUE ESTA ROTA EXISTE (não é organização, é correção de defeito):
 * o `CRMSidePanel` consultava `crm_leads`, `orders` e `crm_lead_activities`
 * DIRETO do navegador, pelo cliente de browser. O cookie de sessão é httpOnly
 * (CLAUDE.md), então o supabase-js do browser não enxerga a sessão e as
 * consultas saem como **anônimas** — provado lendo o `role` do token: `anon`,
 * com um gerente logado na tela.
 *
 * A correção **não** é dar EXECUTE a `anon`: é trazer a leitura para o
 * servidor, onde a sessão existe.
 *
 * **Um pedido, um veredito.** As consultas falham juntas de propósito.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import {
  resolverNegocioAberto,
  type EtapaFicha,
  type LeadFicha,
  type PipelineFicha,
  type PipelineUtilizavel,
} from "@/lib/inbox/crm-summary-tipos";
import { createClient } from "@/lib/supabase/server";
import { nomesDosAtendentes } from "@/lib/users/nome-do-atendente";

export const dynamic = "force-dynamic";

const LEAD_COLS =
  "id, title, status, value_cents, currency, updated_at, last_activity_at, source, pipeline_id, stage_id, owner_user_id, owner_agent_id, created_at, temperatura";
const ORDER_COLS = "id, external_id, status, total_cents, currency, created_at";
const ACTIVITY_COLS =
  "id, type, source_module, performed_at, payload, reason, actor_kind, performed_by_user_id";
const DEMANDA_COLS =
  "id, aberta_em, origem, estado, proximo_passo, proximo_passo_em, prazo_em";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = randomUUID();
  const { id: contactId } = await ctx.params;

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return fail("unauthenticated", "Auth required.", 401, { requestId });
  }

  const { data: contato, error: contatoErr } = await supabase
    .from("contacts")
    .select("id, organization_id")
    .eq("id", contactId)
    .maybeSingle();

  if (contatoErr) {
    return fail("internal_error", contatoErr.message, 500, { requestId });
  }
  if (!contato) {
    return fail("not_found", "Contato não encontrado.", 404, { requestId });
  }

  const orgId = contato.organization_id as string;

  const [leads, orders, activities, demandas, pipelines, stages] = await Promise.all([
    supabase
      .from("crm_leads")
      .select(LEAD_COLS)
      .eq("organization_id", orgId)
      .eq("contact_id", contactId)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("orders")
      .select(ORDER_COLS)
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("crm_lead_activities")
      .select(ACTIVITY_COLS)
      .eq("contact_id", contactId)
      .order("performed_at", { ascending: false })
      .limit(12),
    supabase
      .from("demandas")
      .select(DEMANDA_COLS)
      .eq("contact_id", contactId)
      .is("fechada_em", null)
      .order("aberta_em", { ascending: true })
      .limit(5),
    supabase
      .from("crm_pipelines")
      .select("id, name, is_default")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("is_default", { ascending: false })
      .order("position", { ascending: true }),
    supabase
      .from("crm_stages")
      .select("id, name, pipeline_id, is_won, is_lost")
      .eq("organization_id", orgId)
      .eq("is_archived", false)
      .order("position", { ascending: true }),
  ]);

  const falha =
    leads.error ??
    orders.error ??
    activities.error ??
    demandas.error ??
    pipelines.error ??
    stages.error;
  if (falha) {
    return fail("internal_error", falha.message, 500, { requestId });
  }

  const funis = (pipelines.data ?? []) as PipelineFicha[];
  const etapas = (stages.data ?? []) as EtapaFicha[];
  const funilPorId = new Map(funis.map((p) => [p.id, p]));
  const etapaPorId = new Map(etapas.map((s) => [s.id, s]));

  const linhas = (activities.data ?? []) as Array<{
    performed_by_user_id?: string | null;
    [k: string]: unknown;
  }>;
  const ownerIds = (leads.data ?? []).map((l) => (l as { owner_user_id?: string | null }).owner_user_id);
  const nomes = await nomesDosAtendentes([
    ...linhas.map((a) => a.performed_by_user_id ?? null),
    ...ownerIds,
  ]);

  const leadsFicha: LeadFicha[] = ((leads.data ?? []) as Array<Record<string, unknown>>).map((l) => {
    const pipelineId = l.pipeline_id as string;
    const stageId = l.stage_id as string;
    const ownerUser = (l.owner_user_id as string | null) ?? null;
    const ownerAgent = (l.owner_agent_id as string | null) ?? null;
    const funil = funilPorId.get(pipelineId) ?? null;
    const etapa = etapaPorId.get(stageId) ?? null;
    return {
      id: l.id as string,
      title: l.title as string,
      status: l.status as string,
      value_cents: (l.value_cents as number | null) ?? null,
      currency: (l.currency as string | null) ?? null,
      updated_at: l.updated_at as string,
      last_activity_at: (l.last_activity_at as string | null) ?? null,
      source: (l.source as string | null) ?? null,
      temperatura: (l.temperatura as string | null) ?? null,
      pipeline: funil,
      stage: etapa
        ? {
            id: etapa.id,
            name: etapa.name,
            pipeline_id: etapa.pipeline_id,
            is_won: etapa.is_won,
            is_lost: etapa.is_lost,
          }
        : null,
      owner: {
        user_id: ownerUser,
        agent_id: ownerAgent,
        display_name: ownerUser
          ? (nomes.get(ownerUser) ?? null)
          : ownerAgent
            ? "Assistente"
            : null,
      },
    };
  });

  const etapasPorFunil = new Map<string, EtapaFicha[]>();
  for (const etapa of etapas) {
    const lista = etapasPorFunil.get(etapa.pipeline_id) ?? [];
    lista.push(etapa);
    etapasPorFunil.set(etapa.pipeline_id, lista);
  }

  const pipelines_utilizaveis: PipelineUtilizavel[] = funis.map((p) => ({
    id: p.id,
    name: p.name,
    is_default: p.is_default,
    etapas: (etapasPorFunil.get(p.id) ?? []).filter((e) => !e.is_won && !e.is_lost),
  }));

  const demandasRows = demandas.data ?? [];
  const primeiraDemanda = demandasRows[0] as
    | {
        id: string;
        proximo_passo: string | null;
        proximo_passo_em: string | null;
      }
    | undefined;

  return ok(
    {
      leads: leadsFicha,
      negocio: resolverNegocioAberto(leadsFicha),
      pipelines_utilizaveis,
      proximo_passo_comercial: primeiraDemanda
        ? {
            demanda_id: primeiraDemanda.id,
            proximo_passo: primeiraDemanda.proximo_passo,
            proximo_passo_em: primeiraDemanda.proximo_passo_em,
          }
        : null,
      orders: orders.data ?? [],
      activities: linhas.map((a) => ({
        ...a,
        performed_by_name: a.performed_by_user_id
          ? (nomes.get(a.performed_by_user_id) ?? null)
          : null,
      })),
      demandas: demandasRows,
    },
    { requestId },
  );
}
