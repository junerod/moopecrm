import type { StatusDaCampanha, StatusDoDestinatario } from "@/lib/campanhas/tipos";
import type { TomDs } from "@/lib/design-system/tones";

export const ROTULO_STATUS_CAMPANHA: Record<StatusDaCampanha, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  running: "Enviando",
  completed: "Encerrada",
  cancelled: "Cancelada",
  failed: "Falhou",
};

export const TOM_STATUS_CAMPANHA: Record<StatusDaCampanha, TomDs> = {
  draft: "indigo",
  scheduled: "amber",
  running: "blue",
  completed: "green",
  cancelled: "amber",
  failed: "red",
};

export const ROTULO_STATUS_DESTINATARIO: Record<StatusDoDestinatario, string> = {
  pending: "Na fila",
  skipped: "Ignorado",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  replied: "Respondeu",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export function rotuloStatusCampanha(status: string): string {
  return (ROTULO_STATUS_CAMPANHA as Record<string, string>)[status] ?? status;
}

export function tomStatusCampanha(status: string): TomDs {
  return (TOM_STATUS_CAMPANHA as Record<string, TomDs>)[status] ?? "indigo";
}
