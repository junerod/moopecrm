import type {
  StatusDaCampanha,
  StatusDoDestinatario,
  StatusVisualDaCampanha,
} from "@/lib/campanhas/tipos";
import type { TomDs } from "@/lib/design-system/tones";

export const ROTULO_STATUS_CAMPANHA: Record<StatusVisualDaCampanha, string> = {
  draft: "Rascunho",
  preparing: "Preparando",
  scheduled: "Agendada",
  running: "Enviando",
  completed: "Concluída",
  cancelled: "Cancelada",
  failed: "Falhou",
};

export const TOM_STATUS_CAMPANHA: Record<StatusVisualDaCampanha, TomDs> = {
  draft: "indigo",
  preparing: "blue",
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

export const ROTULO_MOTIVO_PULO: Record<string, string> = {
  contact_blocked: "Bloqueado",
  consent_declined: "Opt-out",
  no_phone: "Sem WhatsApp",
  no_email: "Sem e-mail",
  no_contact: "Contato ausente",
  no_channel: "Sem canal",
  provider_indisponivel: "Canal não dispara este tipo de campanha",
  email_nao_configurado: "E-mail não configurado",
  template_oficial_obrigatorio: "Falta modelo oficial",
  qr_nao_dispara_campanha: "Não envia frio neste número — falta conversa",
  mock_nao_enviou: "Não saiu no WhatsApp — envio de prova",
  sem_conversa_no_numero: "Ainda sem conversa neste WhatsApp — abra o fio na caixa",
};

export function rotuloStatusCampanha(status: string): string {
  return (ROTULO_STATUS_CAMPANHA as Record<string, string>)[status] ?? status;
}

export function tomStatusCampanha(status: string): TomDs {
  return (TOM_STATUS_CAMPANHA as Record<string, TomDs>)[status] ?? "indigo";
}

export function rotuloStatusDestinatario(status: string): string {
  return (ROTULO_STATUS_DESTINATARIO as Record<string, string>)[status] ?? status;
}

export function rotuloMotivoPulo(motivo: string | null | undefined): string {
  if (!motivo) return "";
  return ROTULO_MOTIVO_PULO[motivo] ?? motivo;
}

export function rotuloStatusCampanhaDeLinha(
  status: StatusDaCampanha,
  preparing?: boolean,
): string {
  if (status === "draft" && preparing) return ROTULO_STATUS_CAMPANHA.preparing;
  return rotuloStatusCampanha(status);
}
