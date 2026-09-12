/**
 * Próxima ação comercial — uma fonte: `demandas.proximo_passo` + `proximo_passo_em`.
 *
 * CANÔNICO: a linha de demanda (texto + quando + dono humano).
 * DERIVADO: Inbox, Kanban, Agenda, Hoje (leituras da mesma linha).
 * APENAS IA: `lead_state.next_action` — vira canônico só quando o humano aprova.
 * APENAS VISUAL: chips/atraso — calculados aqui, nunca persistidos.
 *
 * Agenda `calendar_appointments` continua sendo compromisso COMBINADO com o
 * cliente. Criar próxima ação NÃO cria appointment.
 */

export type EstadoDaProximaAcao = "sem" | "aberta" | "atrasada" | "concluida";

export type PresetDeQuando = "hoje" | "amanha" | "em_2_dias";

export interface FatosDaProximaAcao {
  texto: string | null | undefined;
  em: string | Date | null | undefined;
  concluida?: boolean;
}

export function estadoDaProximaAcao(
  fatos: FatosDaProximaAcao,
  agora: Date = new Date(),
): EstadoDaProximaAcao {
  if (fatos.concluida) return "concluida";
  const texto = fatos.texto?.trim() ?? "";
  if (!texto) return "sem";
  const quando = instante(fatos.em);
  if (quando && quando.getTime() < agora.getTime()) return "atrasada";
  return "aberta";
}

export function rotuloDoAtraso(
  em: string | Date | null | undefined,
  agora: Date = new Date(),
): string | null {
  const quando = instante(em);
  if (!quando || quando.getTime() >= agora.getTime()) return null;
  const ms = agora.getTime() - quando.getTime();
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `Atrasado ${min} min`;
  const horas = Math.round(min / 60);
  if (horas < 48) return horas === 1 ? "Atrasado 1 h" : `Atrasado ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "Atrasado 1 dia" : `Atrasado ${dias} dias`;
}

export function rotuloDoQuando(
  em: string | Date | null | undefined,
  agora: Date = new Date(),
): string | null {
  const quando = instante(em);
  if (!quando) return null;
  const hh = pad(quando.getHours());
  const mm = pad(quando.getMinutes());
  const mesmaData = quando.toDateString() === agora.toDateString();
  if (mesmaData) return `Hoje ${hh}:${mm}`;
  const amanha = new Date(agora);
  amanha.setDate(amanha.getDate() + 1);
  if (quando.toDateString() === amanha.toDateString()) return `Amanhã ${hh}:${mm}`;
  const dd = pad(quando.getDate());
  const mo = pad(quando.getMonth() + 1);
  return `${dd}/${mo} ${hh}:${mm}`;
}

/** Presets de criação rápida — hora comercial default 15:00 (hoje) / 10:00 (futuro). */
export function quandoDoPreset(preset: PresetDeQuando, agora: Date = new Date()): Date {
  const d = new Date(agora);
  if (preset === "hoje") {
    d.setHours(15, 0, 0, 0);
    if (d.getTime() <= agora.getTime()) {
      d.setTime(agora.getTime() + 60 * 60_000);
      d.setSeconds(0, 0);
    }
    return d;
  }
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() + (preset === "amanha" ? 1 : 2));
  return d;
}

export function ehAcaoDeHoje(
  em: string | Date | null | undefined,
  agora: Date = new Date(),
): boolean {
  const quando = instante(em);
  if (!quando) return false;
  return quando.toDateString() === agora.toDateString();
}

function instante(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
