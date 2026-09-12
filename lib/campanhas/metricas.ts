import type { StatusDoDestinatario } from "@/lib/campanhas/tipos";

export interface MetricasDaCampanha {
  enviadas: number;
  entregues: number;
  lidas: number;
  respondidas: number;
  falharam: number;
  opt_outs: number;
  puladas: number;
  pendentes: number;
  leads_associados: number;
}

export function agregarMetricas(
  destinatarios: Array<{ status: StatusDoDestinatario | string; lead_id?: string | null }>,
): MetricasDaCampanha {
  const m: MetricasDaCampanha = {
    enviadas: 0,
    entregues: 0,
    lidas: 0,
    respondidas: 0,
    falharam: 0,
    opt_outs: 0,
    puladas: 0,
    pendentes: 0,
    leads_associados: 0,
  };
  for (const d of destinatarios) {
    if (d.lead_id) m.leads_associados += 1;
    switch (d.status) {
      case "sent":
        m.enviadas += 1;
        break;
      case "delivered":
        m.enviadas += 1;
        m.entregues += 1;
        break;
      case "read":
        m.enviadas += 1;
        m.entregues += 1;
        m.lidas += 1;
        break;
      case "replied":
        m.enviadas += 1;
        m.entregues += 1;
        m.lidas += 1;
        m.respondidas += 1;
        break;
      case "failed":
        m.falharam += 1;
        break;
      case "skipped":
        m.puladas += 1;
        m.opt_outs += 1;
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
