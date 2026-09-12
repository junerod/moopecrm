/**
 * Frases leigas para `conversation_assignment_events`.
 * Não é audit log: sem UUID, sem reason cru, sem changed_by técnico.
 */
export const REASONS_DE_ASSIGNMENT = [
  "claim",
  "transfer",
  "release",
  "routing",
  "handoff",
] as const;

export type ReasonDeAssignment = (typeof REASONS_DE_ASSIGNMENT)[number];

export interface EventoDeAssignment {
  reason: string;
  from_user_name: string | null;
  to_user_name: string | null;
  changed_by_name: string | null;
}

function nome(v: string | null | undefined, fallback: string): string {
  const t = v?.trim();
  return t && t.length > 0 ? t : fallback;
}

export function fraseDoAssignment(evento: EventoDeAssignment): string {
  const destino = nome(evento.to_user_name, "um atendente");
  const origem = nome(evento.from_user_name, "a fila");
  const ator = nome(evento.changed_by_name, destino);

  switch (evento.reason) {
    case "claim":
      return `${destino} assumiu`;
    case "transfer":
      return `${ator} transferiu para ${destino}`;
    case "release":
      return `${ator} liberou para fila`;
    case "routing":
      return `Distribuída para ${destino}`;
    case "handoff":
      return `Passou para ${destino}`;
    default:
      return origem === "a fila"
        ? `Atendimento atualizado · ${destino}`
        : `Atendimento atualizado · ${origem} → ${destino}`;
  }
}

export function formatarHoraDoAssignment(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const mesmoDia = d.toDateString() === agora.toDateString();
  if (mesmoDia) return `${hh}:${mm}`;
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} ${hh}:${mm}`;
}
