/**
 * Liga o follow-up de silêncio de 24h já existente — sem segundo scheduler.
 *
 * O grafo é o mesmo formato que o Ready Model grava. Publicar usa
 * `publishFollowupFlowVersion`. AI_MODE OFF continua válido: o motor é
 * determinístico.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { publishFollowupFlowVersion } from "@/lib/followup/publish";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";
import type { FlowGraph } from "@/lib/followup/graph-schema";

export const NOME_FOLLOWUP_24H = "Lembrar cliente se não responder";
export const MENSAGEM_FOLLOWUP_24H = "Olá, conseguiu analisar nossa proposta?";
export const MINUTOS_FOLLOWUP_24H = 1440;

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

async function garantirTemplate(
  admin: SupabaseClient,
  orgId: string,
  actorUserId: string | null,
): Promise<string> {
  const title = "followup-24h-pronto";
  const { data: existente, error: sel } = await admin
    .from("message_templates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("title", title)
    .maybeSingle();
  if (sel) throw new Error(`ler template 24h: ${sel.message}`);
  if (existente) return existente.id as string;

  const { data: criado, error: ins } = await admin
    .from("message_templates")
    .insert({
      organization_id: orgId,
      owner_user_id: null,
      title,
      body: MENSAGEM_FOLLOWUP_24H,
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
): Promise<{ id: string; jaEstavaAtivo: boolean }> {
  const { data: pointers, error: sel } = await admin
    .from("followup_flow_pointers")
    .select("id, name, status, trigger_config, draft_graph")
    .eq("organization_id", orgId);
  if (sel) throw new Error(`ler follow-ups: ${sel.message}`);

  const existentes = (pointers ?? []).filter((p) => ehFollowupDeSilencio(p));
  const ativo = existentes.find((p) => p.status === "active");
  if (ativo) return { id: ativo.id as string, jaEstavaAtivo: true };

  const templateId = await garantirTemplate(admin, orgId, actorUserId);
  const graph = grafoDeSilencio24h(templateId);
  const validacao = validateFlowForPublish(graph);
  if (!validacao.ok) {
    throw new Error(`grafo 24h inválido: ${validacao.errors.map((e) => e.code).join(",")}`);
  }

  const rascunho = existentes[0];
  let pointerId: string;
  if (rascunho) {
    pointerId = rascunho.id as string;
    const { error: upd } = await admin
      .from("followup_flow_pointers")
      .update({
        draft_graph: graph,
        trigger_config: {
          kind: "silence",
          params: { threshold_minutes: MINUTOS_FOLLOWUP_24H },
          cancel_on_reply: true,
        },
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
        trigger_config: {
          kind: "silence",
          params: { threshold_minutes: MINUTOS_FOLLOWUP_24H },
          cancel_on_reply: true,
        },
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
  return { id: pointerId, jaEstavaAtivo: false };
}
