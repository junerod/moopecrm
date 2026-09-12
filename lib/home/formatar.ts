const UM_MIN = 60;
const UMA_HORA = 60 * UM_MIN;
const UM_DIA = 24 * UMA_HORA;

/** Espera ≥ 24h é anomalia — não tratar como KPI normal. */
export function esperaAnomala(seconds: number | null | undefined): boolean {
  return seconds != null && seconds >= UM_DIA;
}

/**
 * Espera operacional. Nunca "332 h 31 min".
 * < 60s → 45s · < 60min → 42 min · < 24h → 3h 18min · ≥ 24h → 13d 20h
 */
export function formatarEspera(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "—";
  const s = Math.round(seconds);
  if (s < UM_MIN) return `${s}s`;
  if (s < UMA_HORA) return `${Math.floor(s / UM_MIN)} min`;
  if (s < UM_DIA) {
    const h = Math.floor(s / UMA_HORA);
    const m = Math.floor((s % UMA_HORA) / UM_MIN);
    return m === 0 ? `${h}h` : `${h}h ${m}min`;
  }
  const d = Math.floor(s / UM_DIA);
  const h = Math.floor((s % UM_DIA) / UMA_HORA);
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

export function saudacaoDoDia(agora: Date = new Date()): string {
  const h = agora.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function primeiroNome(nome: string | null | undefined): string | null {
  const p = nome?.trim().split(/\s+/)[0];
  return p || null;
}

export function formatarValorEtapa(cents: number): string | null {
  if (!Number.isFinite(cents) || cents <= 0) return null;
  const reais = cents / 100;
  if (reais >= 1000) {
    const mil = reais / 1000;
    const texto = mil >= 10 ? String(Math.round(mil)) : mil.toFixed(1).replace(".", ",");
    return `R$ ${texto} mil`;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(reais);
}

export function formatarConversao(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

export function formatarConversaoFina(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1).replace(".", ",")}%`;
}

export interface DeltaExibido {
  texto: string;
  sentido: "alta" | "baixa" | "neutro";
}

/** Só devolve delta quando o anterior é confiável (não 0→N em %). */
export function deltaPercentual(atual: number, anterior: number): DeltaExibido | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior) || anterior <= 0) return null;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return null;
  return {
    texto: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}% vs período anterior`,
    sentido: pct > 0 ? "alta" : "baixa",
  };
}

export function deltaAbsoluto(atual: number, anterior: number): DeltaExibido | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior)) return null;
  const d = atual - anterior;
  if (d === 0) return null;
  return {
    texto: `${d > 0 ? "↑" : "↓"} ${Math.abs(d)}`,
    sentido: d > 0 ? "alta" : "baixa",
  };
}

export function deltaPontos(atual: number | null, anterior: number | null): DeltaExibido | null {
  if (atual == null || anterior == null || !Number.isFinite(atual) || !Number.isFinite(anterior)) {
    return null;
  }
  const pp = Math.round((atual - anterior) * 1000) / 10;
  if (pp === 0) return null;
  const texto = `${pp > 0 ? "↑" : "↓"} ${Math.abs(pp).toFixed(1).replace(".", ",")} p.p.`;
  return { texto, sentido: pp > 0 ? "alta" : "baixa" };
}

export function deltaEspera(
  atual: number | null,
  anterior: number | null,
): DeltaExibido | null {
  if (atual == null || anterior == null || atual <= 0 || anterior <= 0) return null;
  const d = Math.round(atual - anterior);
  if (d === 0) return null;
  const menor = d < 0;
  return {
    texto: `${menor ? "↓" : "↑"} ${formatarEspera(Math.abs(d))}`,
    sentido: menor ? "alta" : "baixa",
  };
}
