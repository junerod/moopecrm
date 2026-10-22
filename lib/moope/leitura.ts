/**
 * Contrato de LEITURA do parceiro (Facejus, locadora, outro sistema).
 *
 * Só projeção. Quem fala com o banco é `leitura-consultar.ts`. A rota não
 * decide forma: se a forma mora aqui, o teste enxerga sem subir o Postgres.
 *
 * O que NÃO sai: telefone, corpo de mensagem, anotação, id de usuário.
 * O cliente do outro lado é o `moope_external_id` que ele mesmo mandou.
 */
import type { KpisDeSupervisao } from "@/lib/supervisao/kpis";

export const DIAS_MAXIMOS_DA_AGENDA = 62;
export const LIMITE_DE_COMPROMISSOS = 200;
export const LIMITE_DE_LEADS = 50;

const MS_DIA = 24 * 60 * 60 * 1000;

export type PapelDaLeitura = "viewer" | "agent" | "manager" | "admin";

const PAPEIS: readonly PapelDaLeitura[] = ["viewer", "agent", "manager", "admin"];

export function papelDaLeitura(role: string | null | undefined): PapelDaLeitura | null {
  if (!role) return null;
  return (PAPEIS as readonly string[]).includes(role) ? (role as PapelDaLeitura) : null;
}

export function ehGestorDaLeitura(papel: PapelDaLeitura): boolean {
  return papel === "manager" || papel === "admin";
}

/** Agente e viewer veem o que é deles. Gestor vê o escritório. */
export function donoDaLeitura(ator: { gestor: boolean; userId: string }): string | null {
  return ator.gestor ? null : ator.userId;
}

export function idExternoDoContato(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const id = (meta as { moope_external_id?: unknown }).moope_external_id;
  return typeof id === "string" && id.trim().length > 0 ? id.trim() : null;
}

/**
 * Hoje e amanhã no fuso de São Paulo, quando o parceiro não manda recorte.
 * A agenda do advogado abre no dia, não no ano.
 */
export function janelaPadraoDaAgenda(agora = new Date()): { de: string; ate: string } {
  const hoje = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  const de = new Date(`${hoje}T00:00:00-03:00`);
  const ate = new Date(de.getTime() + 2 * MS_DIA);
  return { de: de.toISOString(), ate: ate.toISOString() };
}

export function validarJanela(
  de: string,
  ate: string,
): { ok: true } | { ok: false; message: string } {
  const inicio = Date.parse(de);
  const fim = Date.parse(ate);
  if (Number.isNaN(inicio) || Number.isNaN(fim)) {
    return { ok: false, message: "Informe de e ate em ISO-8601 com fuso." };
  }
  if (fim <= inicio) {
    return { ok: false, message: "O fim do período precisa ser depois do começo." };
  }
  if (fim - inicio > DIAS_MAXIMOS_DA_AGENDA * MS_DIA) {
    return { ok: false, message: "O período máximo da agenda é de 62 dias." };
  }
  return { ok: true };
}

export interface CompromissoPublico {
  id: string;
  title: string;
  event_type: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  contact_external_id: string | null;
  contact_name: string | null;
}

export interface AcaoPublica {
  id: string;
  text: string | null;
  due_at: string | null;
  state: string;
  temperature: "frio" | "morno" | "quente" | null;
  contact_external_id: string | null;
  contact_name: string | null;
  lead_title: string | null;
}

export interface LeadPublico {
  id: string;
  title: string;
  status: string;
  stage_name: string | null;
  pipeline_name: string | null;
  value_cents: number | null;
  temperature: "frio" | "morno" | "quente" | null;
  created_at: string;
  contact_external_id: string | null;
  contact_name: string | null;
}

export interface FunilPublico {
  pipelines: Array<{
    id: string;
    name: string;
    open: number;
    won: number;
    lost: number;
    value_open_cents: number;
    stages: Array<{
      name: string;
      count: number;
      value_cents: number;
    }>;
  }>;
  truncated: boolean;
}

export interface PulsoPublico {
  period: "hoje" | "7d" | "30d";
  queue: number;
  oldest_wait_seconds: number;
  first_response_avg_seconds: number | null;
  open_conversations: number;
  new_leads: number;
  open_opportunities: number;
  won: number;
  lost: number;
  conversion: number | null;
  without_next_action: number;
  overdue_actions: number;
  funnel: Array<{
    stage_name: string;
    pipeline_name: string | null;
    count: number;
    value_cents: number;
  }>;
  campaigns_in_period: {
    sent: number;
    replies: number;
    opt_outs: number;
    won: number;
    lost: number;
  };
  losses: Array<{ reason: string; count: number; value_cents: number }>;
}

export function montarFunil(
  pipelines: Array<{ id: string; name: string; position: number }>,
  stages: Array<{
    id: string;
    name: string;
    pipeline_id: string;
    position: number;
    is_won: boolean;
    is_lost: boolean;
  }>,
  abertos: Array<{ stage_id: string; pipeline_id: string; value_cents: number | null }>,
  fechados: Array<{ pipeline_id: string; won: number; lost: number }>,
  truncated: boolean,
): FunilPublico {
  const porEtapa = new Map<string, { count: number; value_cents: number }>();
  const abertosPorFunil = new Map<string, { count: number; value_cents: number }>();
  for (const lead of abertos) {
    const etapa = porEtapa.get(lead.stage_id) ?? { count: 0, value_cents: 0 };
    etapa.count += 1;
    etapa.value_cents += lead.value_cents ?? 0;
    porEtapa.set(lead.stage_id, etapa);
    const funil = abertosPorFunil.get(lead.pipeline_id) ?? { count: 0, value_cents: 0 };
    funil.count += 1;
    funil.value_cents += lead.value_cents ?? 0;
    abertosPorFunil.set(lead.pipeline_id, funil);
  }
  const fechadoPor = new Map(fechados.map((f) => [f.pipeline_id, f]));

  return {
    truncated,
    pipelines: [...pipelines]
      .sort((a, b) => a.position - b.position)
      .map((p) => {
        const aberto = abertosPorFunil.get(p.id);
        const fechado = fechadoPor.get(p.id);
        return {
          id: p.id,
          name: p.name,
          open: aberto?.count ?? 0,
          won: fechado?.won ?? 0,
          lost: fechado?.lost ?? 0,
          value_open_cents: aberto?.value_cents ?? 0,
          stages: stages
            .filter((s) => s.pipeline_id === p.id && !s.is_won && !s.is_lost)
            .sort((a, b) => a.position - b.position)
            .map((s) => ({
              name: s.name,
              count: porEtapa.get(s.id)?.count ?? 0,
              value_cents: porEtapa.get(s.id)?.value_cents ?? 0,
            })),
        };
      }),
  };
}

/** Números do escritório. Sem id de pessoa, sem nome de atendente. */
export function projetarPulso(
  period: PulsoPublico["period"],
  kpis: KpisDeSupervisao,
  pipelineNomes: ReadonlyMap<string, string>,
): PulsoPublico {
  return {
    period,
    queue: kpis.atendimento.fila,
    oldest_wait_seconds: kpis.atendimento.espera_mais_antiga_s,
    first_response_avg_seconds: kpis.atendimento.primeira_resposta_media_s,
    open_conversations: kpis.atendimento.conversas_abertas,
    new_leads: kpis.comercial.leads_novos,
    open_opportunities: kpis.comercial.oportunidades_abertas,
    won: kpis.comercial.ganhos,
    lost: kpis.comercial.perdidos,
    conversion: kpis.comercial.conversao,
    without_next_action: kpis.comercial.sem_proxima_acao,
    overdue_actions: kpis.comercial.atrasadas,
    funnel: kpis.funil.map((e) => ({
      stage_name: e.stage_name,
      pipeline_name: pipelineNomes.get(e.pipeline_id) ?? null,
      count: e.count,
      value_cents: e.value_cents,
    })),
    campaigns_in_period: {
      sent: kpis.campanhas.enviados,
      replies: kpis.campanhas.respostas,
      opt_outs: kpis.campanhas.opt_outs,
      won: kpis.campanhas.ganhos,
      lost: kpis.campanhas.perdidos,
    },
    losses: kpis.perdas.map((p) => ({
      reason: p.motivo,
      count: p.quantidade,
      value_cents: p.valor_cents,
    })),
  };
}
