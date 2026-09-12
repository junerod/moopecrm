import { formatarEspera } from "./formatar";
import type { SnapshotDaHome } from "./tipos";

export interface InsightDaHome {
  texto: string;
}

/** Frases determinísticas a partir do snapshot. Sem LLM, sem causalidade inventada. */
export function insightsDoSnapshot(snap: SnapshotDaHome): InsightDaHome[] {
  const out: InsightDaHome[] = [];
  const atrasadas = snap.personal.atrasadas;
  const quentes = snap.personal.quentes_sem_acao;
  const espera = snap.team?.espera_mais_antiga_s ?? 0;
  const fila = snap.team?.fila ?? 0;
  const conv = snap.commercial?.conversao ?? null;
  const ant = snap.commercial?.vs_anterior?.conversao ?? null;

  if (atrasadas > 0) {
    out.push({
      texto:
        atrasadas === 1
          ? "Você tem 1 retorno vencido."
          : `Você tem ${atrasadas} retornos vencidos.`,
    });
  }
  if (quentes > 0) {
    out.push({
      texto:
        quentes === 1
          ? "Há 1 lead quente sem próxima ação."
          : `Há ${quentes} leads quentes sem próxima ação.`,
    });
  }
  if (snap.papel === "manager" && fila > 0 && espera >= 15 * 60) {
    out.push({
      texto: `A fila está acima do desejável: maior espera ${formatarEspera(espera)}.`,
    });
  }
  if (snap.papel === "manager" && conv != null && ant != null) {
    const pp = Math.round((conv - ant) * 1000) / 10;
    if (pp !== 0) {
      out.push({
        texto: `Conversão ${pp > 0 ? "subiu" : "caiu"} ${Math.abs(pp).toFixed(1).replace(".", ",")} p.p. no período.`,
      });
    }
  }
  return out.slice(0, 3);
}
