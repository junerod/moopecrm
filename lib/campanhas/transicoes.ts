import type { StatusDaCampanha, StatusDoDestinatario } from "@/lib/campanhas/tipos";

const CAMPANHA: Record<StatusDaCampanha, StatusDaCampanha[]> = {
  draft: ["scheduled", "running", "cancelled"],
  scheduled: ["running", "cancelled", "draft"],
  running: ["completed", "cancelled", "failed"],
  completed: [],
  cancelled: [],
  failed: [],
};

export function podeTransitarCampanha(
  de: StatusDaCampanha,
  para: StatusDaCampanha,
): boolean {
  return CAMPANHA[de]?.includes(para) === true;
}

export function destinatarioJaEnviado(status: StatusDoDestinatario): boolean {
  return status === "sent" || status === "delivered" || status === "read" || status === "replied";
}

export function destinatarioTerminal(status: StatusDoDestinatario): boolean {
  return (
    destinatarioJaEnviado(status) ||
    status === "skipped" ||
    status === "failed" ||
    status === "cancelled"
  );
}
