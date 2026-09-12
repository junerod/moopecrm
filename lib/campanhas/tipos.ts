/**
 * Campanha comercial mínima — vocabulário compartilhado.
 *
 * Não é `operational_moope`, não é alerta interno, não é automação conversacional.
 * send_intent desta família: `campaign_commercial`.
 */

export const CAMPANHA_STATUS = [
  "draft",
  "scheduled",
  "running",
  "completed",
  "cancelled",
  "failed",
] as const;
export type StatusDaCampanha = (typeof CAMPANHA_STATUS)[number];

export const DESTINATARIO_STATUS = [
  "pending",
  "skipped",
  "sent",
  "delivered",
  "read",
  "replied",
  "failed",
  "cancelled",
] as const;
export type StatusDoDestinatario = (typeof DESTINATARIO_STATUS)[number];

export const CLASSIFICACAO_CAMPANHA = "campaign_commercial" as const;

export const VARIAVEIS_CONHECIDAS = ["nome", "telefone", "email"] as const;
export type VariavelConhecida = (typeof VARIAVEIS_CONHECIDAS)[number];

export interface SegmentoDaCampanha {
  tags?: string[];
  papel?: string | null;
  origem?: string | null;
  owner_user_id?: string | null;
  pipeline_id?: string | null;
  stage_id?: string | null;
  temperatura?: string | null;
  incluir_bloqueados?: boolean;
  contact_ids?: string[];
}

export interface ContatoParaSegmento {
  id: string;
  display_name?: string | null;
  name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  tags?: string[] | null;
  papel?: string | null;
  source?: string | null;
  is_blocked?: boolean | null;
  consent?: { marketing?: { granted_at?: string | null; declined_at?: string | null } | null } | null;
  owner_user_id?: string | null;
  pipeline_id?: string | null;
  stage_id?: string | null;
  temperatura?: string | null;
}

export function ehStatusDaCampanha(v: string): v is StatusDaCampanha {
  return (CAMPANHA_STATUS as readonly string[]).includes(v);
}

export function ehStatusDoDestinatario(v: string): v is StatusDoDestinatario {
  return (DESTINATARIO_STATUS as readonly string[]).includes(v);
}
