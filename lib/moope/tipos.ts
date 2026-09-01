/** Kind que o parceiro declara. Um protocolo, dois produtos. */
export const MOOPE_KINDS = ["locadora", "juridico"] as const;
export type MoopeKind = (typeof MOOPE_KINDS)[number];

export const MOOPE_INBOUND_TYPES = [
  "person.upserted",
  "contract.changed",
  "process.changed",
  "debt.changed",
] as const;
export type MoopeInboundType = (typeof MOOPE_INBOUND_TYPES)[number];

export const MOOPE_OUTBOUND_TYPES = [
  "conversation.opened",
  "lead.stage_changed",
  "contact.updated",
] as const;
export type MoopeOutboundType = (typeof MOOPE_OUTBOUND_TYPES)[number];

export const MOOPE_LAUNCH_TTL_SECONDS = 90;

export const MOOPE_PATHS_PERMITIDOS = [/^\/app\/contacts(?:\/|$)/, /^\/app\/inbox(?:\?|$)/, /^\/app\/pipeline(?:\?|$)/, /^\/app\/kanban(?:\?|$)/];

export function caminhoDoLaunchEhSeguro(path: string): boolean {
  if (!path.startsWith("/app/")) return false;
  if (path.includes("..") || path.includes("//")) return false;
  return MOOPE_PATHS_PERMITIDOS.some((re) => re.test(path));
}

export interface MoopeConnectionRow {
  id: string;
  organization_id: string;
  kind: MoopeKind;
  partner_webhook_url: string | null;
  /** Base da API do parceiro (GET lookup/retrato). Sem isto, a origem do webhook. */
  partner_api_url: string | null;
  inbound_key_prefix: string;
  inbound_key_hash: string;
  outbound_secret_enc: string | null;
  status: "active" | "disabled";
}

export interface PessoaDoParceiro {
  external_id: string;
  name?: string;
  phone?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface NegocioDoParceiro {
  external_id: string;
  person_external_id: string;
  title?: string;
  stage?: string;
  value_cents?: number;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface DividaDoParceiro {
  external_id: string;
  person_external_id: string;
  faixa?: "em_dia" | "atraso" | "negociando" | "promessa" | "recuperou" | "perdeu";
  amount_cents?: number;
  days_late?: number;
  metadata?: Record<string, unknown>;
}
