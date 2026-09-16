/**
 * Pack de Negócio — configuração versionada do produto existente.
 *
 * O instalador copia DADO para o tenant. O runtime lê pipeline, agentes,
 * coleções e router — nunca `if (pack === "locadora")`.
 */
import type { AiMode } from "@/lib/schemas/settings";
import type { PropostaDeFunil } from "@/lib/onboarding/proposta-de-funil";
import type { ReadyModelId, ReadyModelSubtype, ReadyModelField, ReadyModelVocabulary } from "@/lib/ready-models/tipos";

export const BUSINESS_PACK_IDS = [
  "locadora_veiculos",
  "escritorio_advocacia",
  "vendas_saas",
  "comercial_geral",
  "clinica_medica",
  "clinica_odontologica",
] as const;
export type BusinessPackId = (typeof BUSINESS_PACK_IDS)[number];

export const CHAVE_PACK = "business_pack";

export interface PackCollectionSeed {
  slug: string;
  name: string;
}

export interface PackSpecialtySeed {
  key: string;
  name: string;
  description: string;
  voice: string;
  collection_slugs: string[];
  /** Se true, vira o is_default — um só, para uma conversa. */
  is_default?: boolean;
  /** Tools MCP reais (ids do catálogo). Vazio = nenhuma tool operacional. */
  tool_ids: string[];
}

export interface PackIntentSeed {
  name: string;
  description: string;
  examples: string[];
  keywords: string[];
  specialty_key: string;
}

export interface PackQuickReplySeed {
  key: string;
  title: string;
  body: string;
}

export interface PackAutomationSeed {
  key: string;
  name: string;
  /** Frase para o leigo — o que acontece se ligar. */
  description?: string;
  /** Se true, só aparece na UI — o motor não tem dado operacional. */
  requires_gestao?: boolean;
  trigger_event?: "lead.created" | "lead.stage_changed" | "message.received";
  /** Casa com `crm_stages.name` no funil do Pack. Instalador vira `lead.stage_id`. */
  stage_name?: string;
  actions?: Array<{ type: "add_tag"; config: { tags: string[] } }>;
  followup_minutes?: number;
}

/** Fluxo de follow-up pronto — mensagem + gatilho. Nasce rascunho. */
export interface PackFollowupSeed {
  key: string;
  name: string;
  description: string;
  kind: "silence" | "stage_change";
  /** Silêncio, em minutos (5–10080). */
  threshold_minutes?: number;
  /** `crm_stages.name` do funil do Pack. */
  stage_name?: string;
  /** Espera depois da etapa, em minutos. Piso do motor: 5. */
  wait_minutes?: number;
  /** Segunda espera do modelo operacional, em minutos. */
  wait2_minutes?: number;
  message: string;
  /** Segundo recado do modelo (só manda se o card ainda estiver na etapa). */
  message_2?: string;
  /** Se true, o grafo checa se o lead ainda está na etapa antes de falar. */
  com_condicao?: boolean;
  /** Passos visíveis: como o fluxo trabalha. */
  passos?: string[];
  /** Como o leigo usa no dia a dia. */
  como_usar?: string;
  /** Card em destaque na tela. */
  destaque?: boolean;
}

export interface PackCampaignSeed {
  key: string;
  title: string;
  body: string;
}

export interface PackCapabilitySlot {
  key: string;
  label: string;
  /** Tool MCP real, se existir no código. */
  tool_id: string | null;
  read: boolean;
  write: boolean;
}

export interface BusinessPackDefinition {
  id: BusinessPackId;
  version: string;
  label: string;
  description: string;
  ready_model_id: ReadyModelId;
  ready_model_subtype?: ReadyModelSubtype;
  pipeline: PropostaDeFunil;
  fields: ReadyModelField[];
  vocabulary: ReadyModelVocabulary;
  collections: PackCollectionSeed[];
  specialties: PackSpecialtySeed[];
  intents: PackIntentSeed[];
  quick_replies: PackQuickReplySeed[];
  automations: PackAutomationSeed[];
  followups: PackFollowupSeed[];
  campaigns: PackCampaignSeed[];
  capabilities: PackCapabilitySlot[];
  ai_mode_default: Extract<AiMode, "copilot" | "controlled">;
}

export interface PackArtifacts {
  pipeline_id?: string;
  agent_keys: Record<string, string>;
  collection_slugs: Record<string, string>;
  router_id?: string;
  template_keys: Record<string, string>;
  automation_keys: Record<string, string>;
  campaign_keys: Record<string, string>;
  followup_keys: Record<string, string>;
}

export type BusinessPackStatus = "active" | "inactive";

export interface BusinessPackGravado {
  id: BusinessPackId;
  version: string;
  installed_at: string;
  artifacts: PackArtifacts;
  /** Ausente em instalações antigas = ativo. */
  status?: BusinessPackStatus;
}

export interface OpcoesDoPack {
  actorUserId?: string | null;
  /** Reaplica só o que falta. Nunca sobrescreve artefato existente. */
  soPreencherFaltantes?: boolean;
}

export type ResultadoDoPack =
  | {
      ok: true;
      noop: true;
      pack: BusinessPackGravado;
    }
  | {
      ok: true;
      noop: false;
      pack: BusinessPackGravado;
      criou: {
        agentes: number;
        colecoes: number;
        templates: number;
        automacoes: number;
        campanhas: number;
        fluxos: number;
      };
    };
