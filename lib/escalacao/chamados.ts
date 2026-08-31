/**
 * Os chamados humanos — leitura compartilhada entre a tela e o agente.
 *
 * As duas consultas viviam dentro de `app/api/v1/ai/cases/route.ts` e
 * `.../[id]/route.ts`, servindo só à tela. O agente abria o chamado e não
 * conseguia mais olhar para ele: não sabia listar, não sabia se foi respondido,
 * não lia o que a pessoa decidiu. Extraído (Decisão 4 do briefing IA 360) para
 * que a pessoa e o agente vejam o MESMO chamado, pela mesma consulta.
 *
 * Só leitura aqui. A máquina de estados do chamado é
 * `lib/agent-engine/agent/human-cases.ts` (transições sobre `pg`, atômicas) —
 * duplicá-la em PostgREST daria dois donos para a mesma regra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { COLUNAS_DO_ROTULO, completarContatosComGemeo } from "@/lib/contacts/completar-com-gemeo";
import {
  contatoDoEmbed,
  rotuloDoContato,
  SEM_NOME,
  telefoneApresentavel,
  type ContatoNomeavel,
} from "@/lib/contacts/rotulo-do-contato";

export const ESTADOS_ABERTOS = ["awaiting_human", "awaiting_lead"] as const;
export const ESTADOS_FECHADOS = ["resolved", "escalated", "cancelled"] as const;

export interface ChamadoDaLista {
  id: string;
  title: string;
  summary: string;
  blocker: string;
  status: string;
  opened_at: string;
  conversation_id: string;
  contact_name: string | null;
  contact_phone: string | null;
}

export interface EventoDoChamado {
  id: string;
  kind: string;
  actor_kind: string;
  actor_user_id: string | null;
  human_action: string | null;
  body: string | null;
  created_at: string;
}

export interface ChamadoDetalhado extends ChamadoDaLista {
  source: string;
  closed_at: string | null;
  events: EventoDoChamado[];
}

const COLUNAS_LISTA =
  "id, title, summary, blocker, status, opened_at, conversation_id, " +
  `conversations:conversation_id(contacts:contact_id(${COLUNAS_DO_ROTULO}))`;

const COLUNAS_DETALHE =
  "id, title, summary, blocker, status, source, opened_at, closed_at, conversation_id, " +
  `conversations:conversation_id(contacts:contact_id(${COLUNAS_DO_ROTULO}))`;

interface LinhaComContato {
  id: string;
  title: string;
  summary: string;
  blocker: string;
  status: string;
  opened_at: string;
  conversation_id: string;
  source?: string;
  closed_at?: string | null;
  conversations:
    | { contacts: ContatoNomeavel | ContatoNomeavel[] | null }
    | { contacts: ContatoNomeavel | ContatoNomeavel[] | null }[]
    | null;
}

function contatoDaLinha(r: LinhaComContato): ContatoNomeavel | null {
  const conv = Array.isArray(r.conversations) ? r.conversations[0] : r.conversations;
  return contatoDoEmbed(conv?.contacts ?? null);
}

function achatarContato(r: LinhaComContato, contato: ContatoNomeavel | null): ChamadoDaLista {
  const rotulo = rotuloDoContato(contato);
  const tel = telefoneApresentavel(contato);
  return {
    id: r.id,
    title: r.title,
    summary: r.summary,
    blocker: r.blocker,
    status: r.status,
    opened_at: r.opened_at,
    conversation_id: r.conversation_id,
    contact_name: rotulo === SEM_NOME ? null : rotulo,
    contact_phone: tel || null,
  };
}

export interface ResultadoDaLista {
  chamados: ChamadoDaLista[];
  /** Quantos continuam abertos — independe do filtro pedido. */
  abertos: number;
}

export async function listarChamados(
  supabase: SupabaseClient,
  organizationId: string,
  opts: { estado: "abertos" | "fechados"; limite?: number },
): Promise<ResultadoDaLista> {
  const estados = opts.estado === "abertos" ? ESTADOS_ABERTOS : ESTADOS_FECHADOS;

  const base = supabase
    .from("agent_cases")
    .select(COLUNAS_LISTA)
    .eq("organization_id", organizationId)
    .in("status", estados as unknown as string[])
    .order("opened_at", { ascending: false });

  const { data, error } = await (opts.limite === undefined ? base : base.limit(opts.limite));
  if (error) throw new Error(error.message);

  const { count } = await supabase
    .from("agent_cases")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ESTADOS_ABERTOS as unknown as string[]);

  const linhas = (data ?? []) as unknown as LinhaComContato[];
  const brutos = linhas.map(contatoDaLinha).filter((c): c is ContatoNomeavel => c !== null);
  const completos = await completarContatosComGemeo(supabase, organizationId, brutos);
  const porId = new Map(completos.filter((c) => c.id).map((c) => [c.id as string, c]));

  return {
    chamados: linhas.map((r) => {
      const c = contatoDaLinha(r);
      return achatarContato(r, c?.id ? (porId.get(c.id) ?? c) : c);
    }),
    abertos: count ?? 0,
  };
}

/** null = não existe OU é de outra organização — 404 honesto, sem vazar existência. */
export async function lerChamado(
  supabase: SupabaseClient,
  organizationId: string,
  caseId: string,
): Promise<ChamadoDetalhado | null> {
  const { data: caseRow, error: caseErr } = await supabase
    .from("agent_cases")
    .select(COLUNAS_DETALHE)
    .eq("id", caseId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (caseErr) throw new Error(caseErr.message);
  if (!caseRow) return null;

  const { data: events, error: eventsErr } = await supabase
    .from("agent_case_events")
    .select("id, kind, actor_kind, actor_user_id, human_action, body, created_at")
    .eq("organization_id", organizationId)
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (eventsErr) throw new Error(eventsErr.message);

  const linha = caseRow as unknown as LinhaComContato;
  const bruto = contatoDaLinha(linha);
  const [resolvido] = bruto
    ? await completarContatosComGemeo(supabase, organizationId, [bruto])
    : [null];
  return {
    ...achatarContato(linha, resolvido ?? bruto),
    source: linha.source ?? "agent",
    closed_at: linha.closed_at ?? null,
    events: (events ?? []) as EventoDoChamado[],
  };
}
