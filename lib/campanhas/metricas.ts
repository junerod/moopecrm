import { ehOptOut } from "@/lib/campanhas/consentimento";
import type { CanalDaCampanha, StatusDoDestinatario } from "@/lib/campanhas/tipos";

export interface MetricasDaCampanha {
  destinatarios: number;
  enviadas: number;
  entregues: number;
  lidas: number;
  respondidas: number;
  falharam: number;
  opt_outs: number;
  puladas: number;
  ignoradas: number;
  pendentes: number;
  leads_associados: number;
  ganhos: number;
  perdidos: number;
  valor_ganho_cents: number;
  por_canal?: Partial<Record<CanalDaCampanha, { enviadas: number; falharam: number }>>;
}

export function agregarMetricas(
  destinatarios: Array<{
    status: StatusDoDestinatario | string;
    lead_id?: string | null;
    error?: string | null;
    channel?: string | null;
  }>,
): MetricasDaCampanha {
  const m: MetricasDaCampanha = {
    destinatarios: destinatarios.length,
    enviadas: 0,
    entregues: 0,
    lidas: 0,
    respondidas: 0,
    falharam: 0,
    opt_outs: 0,
    puladas: 0,
    ignoradas: 0,
    pendentes: 0,
    leads_associados: 0,
    ganhos: 0,
    perdidos: 0,
    valor_ganho_cents: 0,
    por_canal: { whatsapp: { enviadas: 0, falharam: 0 }, email: { enviadas: 0, falharam: 0 } },
  };
  for (const d of destinatarios) {
    if (d.lead_id) m.leads_associados += 1;
    const canal = d.channel === "email" ? "email" : d.channel === "whatsapp" ? "whatsapp" : null;
    switch (d.status) {
      case "sent":
        m.enviadas += 1;
        if (canal) m.por_canal![canal]!.enviadas += 1;
        break;
      case "delivered":
        m.enviadas += 1;
        m.entregues += 1;
        if (canal) m.por_canal![canal]!.enviadas += 1;
        break;
      case "read":
        m.enviadas += 1;
        m.entregues += 1;
        m.lidas += 1;
        if (canal) m.por_canal![canal]!.enviadas += 1;
        break;
      case "replied":
        m.enviadas += 1;
        m.entregues += 1;
        m.lidas += 1;
        m.respondidas += 1;
        if (canal) m.por_canal![canal]!.enviadas += 1;
        break;
      case "failed":
        m.falharam += 1;
        if (canal) m.por_canal![canal]!.falharam += 1;
        break;
      case "skipped":
        m.puladas += 1;
        m.ignoradas += 1;
        if (ehOptOut(d.error)) m.opt_outs += 1;
        break;
      case "cancelled":
        m.ignoradas += 1;
        break;
      case "pending":
        m.pendentes += 1;
        break;
      default:
        break;
    }
  }
  return m;
}

/** Desfecho comercial dos leads já associados — sem contar o mesmo lead duas vezes. */
export function desfechoDosLeads(
  leads: Array<{ status?: string | null; value_cents?: number | null }>,
): Pick<MetricasDaCampanha, "ganhos" | "perdidos" | "valor_ganho_cents"> {
  let ganhos = 0;
  let perdidos = 0;
  let valor_ganho_cents = 0;
  for (const l of leads) {
    if (l.status === "won") {
      ganhos += 1;
      valor_ganho_cents += Math.max(0, l.value_cents ?? 0);
    } else if (l.status === "lost") {
      perdidos += 1;
    }
  }
  return { ganhos, perdidos, valor_ganho_cents };
}

export function aplicarDesfecho(
  m: MetricasDaCampanha,
  d: Pick<MetricasDaCampanha, "ganhos" | "perdidos" | "valor_ganho_cents">,
): MetricasDaCampanha {
  return { ...m, ...d };
}

export function desfechoPorLeadIds(
  leadIds: string[],
  leads: Array<{ id: string; status?: string | null; value_cents?: number | null }>,
): Pick<MetricasDaCampanha, "ganhos" | "perdidos" | "valor_ganho_cents"> {
  const ids = new Set(leadIds);
  return desfechoDosLeads(leads.filter((l) => ids.has(l.id)));
}

export interface LinhaDeComparacao {
  chave: string;
  rotulo: string;
  a: number;
  b: number;
  delta: number;
}

/** Ganhos por envio, em pontos percentuais inteiros. Sem envio = 0. */
export function taxaDeGanhoDaCampanha(m: Pick<MetricasDaCampanha, "enviadas" | "ganhos">): number {
  if (m.enviadas <= 0) return 0;
  return Math.round((m.ganhos / m.enviadas) * 100);
}

/** Mesmo recorte: envio, resposta, negócio, ganho, conversão, perda e receita. */
export function compararDuasCampanhas(
  a: MetricasDaCampanha,
  b: MetricasDaCampanha,
): LinhaDeComparacao[] {
  const pares: Array<[string, string, number, number]> = [
    ["enviadas", "Enviadas", a.enviadas, b.enviadas],
    ["respondidas", "Respostas", a.respondidas, b.respondidas],
    ["leads", "Negócios", a.leads_associados, b.leads_associados],
    ["ganhos", "Ganhos", a.ganhos, b.ganhos],
    ["conversao", "Conversão", taxaDeGanhoDaCampanha(a), taxaDeGanhoDaCampanha(b)],
    ["perdidos", "Perdas", a.perdidos, b.perdidos],
    ["receita", "Receita ganha", a.valor_ganho_cents, b.valor_ganho_cents],
  ];
  return pares.map(([chave, rotulo, va, vb]) => ({
    chave,
    rotulo,
    a: va,
    b: vb,
    delta: va - vb,
  }));
}

export function taxasDaCampanha(
  m: MetricasDaCampanha,
  disponibilidade: { entregue: boolean; lida: boolean; resposta: boolean },
): {
  entrega: number | null;
  leitura: number | null;
  resposta: number | null;
} {
  const base = m.enviadas;
  return {
    entrega: disponibilidade.entregue && base > 0 ? m.entregues / base : null,
    leitura: disponibilidade.lida && base > 0 ? m.lidas / base : null,
    resposta: disponibilidade.resposta && base > 0 ? m.respondidas / base : null,
  };
}
