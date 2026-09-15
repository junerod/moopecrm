/**
 * Liga o follow-up de silêncio já existente — sem segundo scheduler.
 *
 * O grafo é o mesmo formato que o Ready Model grava. Publicar usa
 * `publishFollowupFlowVersion`. AI_MODE OFF continua válido: o motor é
 * determinístico. Mensagem e espera saem da tela Prontas, não ficam
 * presas na semente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { publishFollowupFlowVersion } from "@/lib/followup/publish";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";
import type { FlowGraph } from "@/lib/followup/graph-schema";

export const NOME_FOLLOWUP_24H = "Lembrar cliente se não responder";
export const MENSAGEM_FOLLOWUP_24H = "Olá, conseguiu analisar nossa proposta?";
export const MINUTOS_FOLLOWUP_24H = 1440;
export const TITULO_TEMPLATE_FOLLOWUP_24H = "followup-24h-pronto";

export const ajusteFollowup24hSchema = z
  .object({
    mensagem: z.string().trim().min(1).max(1000).optional(),
    horas: z.coerce.number().int().min(1).max(168).optional(),
  })
  .strict();

export type AjusteFollowup24h = z.infer<typeof ajusteFollowup24hSchema>;

export function resolverAjusteFollowup24h(
  bruto: AjusteFollowup24h | undefined,
  atual: { mensagem: string; minutos: number },
): { mensagem: string; minutos: number } {
  const mensagem = bruto?.mensagem?.trim() || atual.mensagem;
  const minutos = bruto?.horas != null ? bruto.horas * 60 : atual.minutos;
  return { mensagem, minutos };
}

export function minutosDoTrigger(cfg: unknown): number | null {
  const params = (cfg as { kind?: string; params?: { threshold_minutes?: unknown } } | null)
    ?.params;
  const n = params?.threshold_minutes;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

export function horasDoFollowup(trigger_config: unknown): number {
  const m = minutosDoTrigger(trigger_config);
  if (m == null) return MINUTOS_FOLLOWUP_24H / 60;
  return Math.max(1, Math.min(168, Math.round(m / 60)));
}

export function grafoDeSilencio24h(templateId: string): FlowGraph {
  return {
    nodes: [
      { id: "t1", type: "trigger", label: "Início", position: { x: 0, y: 0 }, config: {} },
      {
        id: "a1",
        type: "action",
        label: "Lembrete",
        position: { x: 220, y: 0 },
        config: { mode: "template", template_id: templateId },
      },
      {
        id: "e1",
        type: "end",
        label: "Fim",
        position: { x: 440, y: 0 },
        config: { outcome: "converted" },
      },
    ],
    edges: [
      { id: "t1-a1", source: "t1", target: "a1", priority: 0, condition: { type: "always" } },
      { id: "a1-e1", source: "a1", target: "e1", priority: 0, condition: { type: "always" } },
    ],
  };
}

export function ehFollowupDeSilencio(row: {
  name?: string | null;
  status?: string | null;
  trigger_config?: unknown;
}): boolean {
  const cfg = row.trigger_config as { kind?: string } | null;
  if (cfg?.kind === "silence") return true;
  const nome = (row.name ?? "").toLowerCase();
  return nome.includes("silencio-24h") || nome === NOME_FOLLOWUP_24H.toLowerCase();
}

async function lerBodyDoTemplate(
  admin: SupabaseClient,
  orgId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from("message_templates")
    .select("body")
    .eq("organization_id", orgId)
    .eq("title", TITULO_TEMPLATE_FOLLOWUP_24H)
    .maybeSingle();
  if (error) throw new Error(`ler template 24h: ${error.message}`);
  return typeof data?.body === "string" && data.body.trim() ? data.body : null;
}

async function garantirTemplate(
  admin: SupabaseClient,
  orgId: string,
  actorUserId: string | null,
  mensagem: string,
): Promise<string> {
  const { data: existente, error: sel } = await admin
    .from("message_templates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("title", TITULO_TEMPLATE_FOLLOWUP_24H)
    .maybeSingle();
  if (sel) throw new Error(`ler template 24h: ${sel.message}`);
  if (existente) {
    const { error: upd } = await admin
      .from("message_templates")
      .update({ body: mensagem } as never)
      .eq("id", existente.id)
      .eq("organization_id", orgId);
    if (upd) throw new Error(`atualizar template 24h: ${upd.message}`);
    return existente.id as string;
  }

  const { data: criado, error: ins } = await admin
    .from("message_templates")
    .insert({
      organization_id: orgId,
      owner_user_id: null,
      title: TITULO_TEMPLATE_FOLLOWUP_24H,
      body: mensagem,
      created_by_user_id: actorUserId,
    } as never)
    .select("id")
    .single();
  if (ins || !criado) throw new Error(`criar template 24h: ${ins?.message ?? "sem id"}`);
  return criado.id as string;
}

export async function ativarFollowup24h(
  admin: SupabaseClient,
  orgId: string,
  actorUserId: string,
  opts: AjusteFollowup24h = {},
): Promise<{ id: string; jaEstavaAtivo: boolean; mensagem: string; minutos: number }> {
  const { data: pointers, error: sel } = await admin
    .from("followup_flow_pointers")
    .select("id, name, status, trigger_config, draft_graph")
    .eq("organization_id", orgId);
  if (sel) throw new Error(`ler follow-ups: ${sel.message}`);

  const existentes = (pointers ?? []).filter((p) => ehFollowupDeSilencio(p));
  const ativo = existentes.find((p) => p.status === "active");
  const pediuAjuste = opts.mensagem != null || opts.horas != null;
  if (ativo && !pediuAjuste) {
    return {
      id: ativo.id as string,
      jaEstavaAtivo: true,
      mensagem: (await lerBodyDoTemplate(admin, orgId)) ?? MENSAGEM_FOLLOWUP_24H,
      minutos: minutosDoTrigger(ativo.trigger_config) ?? MINUTOS_FOLLOWUP_24H,
    };
  }

  const base = ativo ?? existentes[0];
  const { mensagem, minutos } = resolverAjusteFollowup24h(opts, {
    mensagem: (await lerBodyDoTemplate(admin, orgId)) ?? MENSAGEM_FOLLOWUP_24H,
    minutos: minutosDoTrigger(base?.trigger_config) ?? MINUTOS_FOLLOWUP_24H,
  });

  const templateId = await garantirTemplate(admin, orgId, actorUserId, mensagem);
  const graph = grafoDeSilencio24h(templateId);
  const validacao = validateFlowForPublish(graph);
  if (!validacao.ok) {
    throw new Error(`grafo 24h inválido: ${validacao.errors.map((e) => e.code).join(",")}`);
  }

  const trigger = {
    kind: "silence" as const,
    params: { threshold_minutes: minutos },
    cancel_on_reply: true,
  };

  let pointerId: string;
  if (base) {
    pointerId = base.id as string;
    const { error: upd } = await admin
      .from("followup_flow_pointers")
      .update({
        draft_graph: graph,
        trigger_config: trigger,
        handoff_policy: "pause",
      } as never)
      .eq("id", pointerId)
      .eq("organization_id", orgId);
    if (upd) throw new Error(`preparar follow-up 24h: ${upd.message}`);
  } else {
    const { data: criado, error: ins } = await admin
      .from("followup_flow_pointers")
      .insert({
        organization_id: orgId,
        name: NOME_FOLLOWUP_24H,
        status: "draft",
        draft_graph: graph,
        handoff_policy: "pause",
        trigger_config: trigger,
      } as never)
      .select("id")
      .single();
    if (ins || !criado) throw new Error(`criar follow-up 24h: ${ins?.message ?? "sem id"}`);
    pointerId = criado.id as string;
  }

  const pub = await publishFollowupFlowVersion(admin, {
    orgId,
    pointerId,
    graph,
    createdBy: actorUserId,
  });
  if (!pub.ok) throw new Error(`publicar follow-up 24h: ${pub.message}`);
  return { id: pointerId, jaEstavaAtivo: Boolean(ativo), mensagem, minutos };
}
