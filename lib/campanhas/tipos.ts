/**
 * Campanha comercial — vocabulário compartilhado.
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

/** Estado visual. `preparing` vive em settings, não no CHECK do banco. */
export const CAMPANHA_STATUS_VISUAL = [
  ...CAMPANHA_STATUS,
  "preparing",
] as const;
export type StatusVisualDaCampanha = (typeof CAMPANHA_STATUS_VISUAL)[number];

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

export const CANAIS_DA_CAMPANHA = ["whatsapp", "email"] as const;
export type CanalDaCampanha = (typeof CANAIS_DA_CAMPANHA)[number];

export const SELECAO_DE_CANAIS = ["whatsapp", "email", "ambos"] as const;
export type SelecaoDeCanais = (typeof SELECAO_DE_CANAIS)[number];

export const OBJETIVOS_DA_CAMPANHA = [
  "promocao",
  "reativacao",
  "followup",
  "aviso",
  "pesquisa",
  "personalizada",
] as const;
export type ObjetivoDaCampanha = (typeof OBJETIVOS_DA_CAMPANHA)[number];

export const PRESETS_DE_CONTEUDO = ["aviso", "post", "video", "catalogo"] as const;
export type PresetDeConteudo = (typeof PRESETS_DE_CONTEUDO)[number];

export const CLASSIFICACAO_CAMPANHA = "campaign_commercial" as const;

export const VARIAVEIS_CONHECIDAS = ["nome", "telefone", "email"] as const;
export type VariavelConhecida = (typeof VARIAVEIS_CONHECIDAS)[number];

export const LIMITE_SEGMENTO = 5_000;
export const LIMITE_SELECAO_MANUAL = 2_000;
export const LIMITE_CONFIRMACAO_LOTE = 200;
export const LOTE_MATERIALIZACAO = 200;
export const LOTE_ENVIO = 20;

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

export interface AnexoDaCampanha {
  storage_path: string;
  mime: string;
  size_bytes: number;
  filename: string;
  kind: "image" | "video" | "document";
  preview_url?: string | null;
}

export interface SettingsDaCampanha {
  objective?: ObjetivoDaCampanha | null;
  channels?: SelecaoDeCanais;
  attachments?: AnexoDaCampanha[];
  content_preset?: PresetDeConteudo;
  preparing?: boolean;
  materializing?: boolean;
  confirm_all_base?: boolean;
  confirm_large?: boolean;
  message_template_id?: string | null;
  cta_url?: string | null;
  cta_label?: string | null;
  timezone?: string | null;
  somente_conversa_existente?: boolean;
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

export function ehCanalDaCampanha(v: string): v is CanalDaCampanha {
  return (CANAIS_DA_CAMPANHA as readonly string[]).includes(v);
}

export function ehSelecaoDeCanais(v: string): v is SelecaoDeCanais {
  return (SELECAO_DE_CANAIS as readonly string[]).includes(v);
}

export function segmentoVazio(segmento: SegmentoDaCampanha): boolean {
  return (
    !(segmento.tags && segmento.tags.length > 0) &&
    !segmento.papel &&
    !segmento.origem &&
    !segmento.owner_user_id &&
    !segmento.pipeline_id &&
    !segmento.stage_id &&
    !segmento.temperatura &&
    !(segmento.contact_ids && segmento.contact_ids.length > 0)
  );
}

export function canaisDaSelecao(selecao: SelecaoDeCanais | null | undefined): CanalDaCampanha[] {
  if (selecao === "email") return ["email"];
  if (selecao === "ambos") return ["whatsapp", "email"];
  return ["whatsapp"];
}
