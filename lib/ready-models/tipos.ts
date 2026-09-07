/**
 * Ready Model — definition é DADO. O instalador não conhece nicho.
 *
 * Depois da cópia, o tenant é dono. O runtime lê pipeline/settings, nunca
 * `if (id === "locacao")`.
 */
import type { AiMode } from "@/lib/schemas/settings";
import type { PropostaDeFunil } from "@/lib/onboarding/proposta-de-funil";

export const READY_MODEL_IDS = [
  "locacao",
  "advocacia",
  "comercial",
  "servicos",
  "personalizado",
] as const;
export type ReadyModelId = (typeof READY_MODEL_IDS)[number];

export const READY_MODEL_VERSION = "1.0";

export const LOCACAO_SUBTYPES = [
  "veiculos",
  "maquinas_e_equipamentos",
  "ferramentas",
  "imoveis",
  "outros",
] as const;
export type LocacaoSubtype = (typeof LOCACAO_SUBTYPES)[number];

export type ReadyModelSubtype = LocacaoSubtype;

export interface ReadyModelField {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "select"
    | "multiselect"
    | "boolean"
    | "email"
    | "phone"
    | "url";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}

export interface ReadyModelVocabulary {
  lead?: string;
  deal?: string;
  won?: string;
  lost?: string;
}

export interface ReadyModelCopilotOverlay {
  /** Instrução curta. Entra no mesmo copilot_turn — não cria outro Copilot. */
  instruction: string;
}

export interface ReadyModelAutomationSeed {
  /** Nome estável — select-before-insert. Prefixo `rm:` é o contrato de idempotência. */
  name: string;
  trigger_event: "lead.created";
  actions: Array<{ type: "add_tag"; config: { tags: string[] } }>;
}

export interface ReadyModelFollowupSeed {
  /** Nome estável do pointer. */
  name: string;
  /** Corpo do template de 1 mensagem. */
  template_name: string;
  template_body: string;
  silence_threshold_minutes: number;
}

export interface ReadyModelDefinition {
  id: ReadyModelId;
  version: string;
  label: string;
  description: string;
  subtype?: ReadyModelSubtype;
  pipeline: PropostaDeFunil;
  fields: ReadyModelField[];
  canonicalTags: string[];
  lostReasons: string[];
  vocabulary?: ReadyModelVocabulary;
  automation?: ReadyModelAutomationSeed;
  followup?: ReadyModelFollowupSeed;
  aiDefaults: { ai_mode: AiMode };
  copilotOverlay: ReadyModelCopilotOverlay;
}

/** O que fica em organizations.settings.perfil_do_negocio. */
export interface PerfilDoNegocioGravado {
  id: ReadyModelId;
  version: string;
  subtype?: ReadyModelSubtype;
  aplicado_em: string;
}

export interface OpcoesDoInstalador {
  /** Personalizado: sobrescreve nome/etapas sem mudar o resto da definition. */
  pipelineOverride?: PropostaDeFunil;
  /** Wizard: instalar o fluxo de follow-up. Default false. */
  followup: boolean;
  /** Se true e o mesmo id+version+subtype já está gravado, não toca artifacts. */
  noopSeJaAplicado?: boolean;
  /** Quem publica o follow-up. Sem isto o fluxo fica em rascunho. */
  actorUserId?: string | null;
}

export type ResultadoDoReadyModel =
  | {
      ok: true;
      noop: true;
      perfil: PerfilDoNegocioGravado;
      pipelinePadraoId: string;
      criouQuadroNovo: false;
    }
  | {
      ok: true;
      noop: false;
      perfil: PerfilDoNegocioGravado;
      pipelinePadraoId: string;
      criouQuadroNovo: boolean;
      artifacts: {
        automation_rule_id: string | null;
        followup_pointer_id: string | null;
      };
    };
