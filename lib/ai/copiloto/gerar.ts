/**
 * Gera uma sugestão de Copilot. Sem tools, sem send, sem mutação de CRM.
 * A persistência é o único write — e é a própria sugestão.
 */
import { copilotSuggestionSchema, type CopilotSuggestion } from "./schema";
import { registrarExecucaoDoCopiloto } from "./medir";
import {
  buscarSugestaoDaMensagem,
  gravarSugestao,
  type CopilotSuggestionRow,
} from "./persistir";
import type { Queryable } from "@/lib/agent-engine/queue/queue";
import type { AiExecutionPolicy } from "@/lib/ai/execucao/politica";
import {
  filtrarCamposExtraidos,
  montarSystemDoCopiloto,
  type OverlayDoCopiloto,
} from "@/lib/ai/copiloto/overlay";
import {
  deveRecusarInventar,
  NAO_CONSEGUI_CONSULTAR_GESTAO,
  perguntaPedeDadoGestao,
  RASCUNHO_SEM_FONTE,
} from "@/lib/ai/copiloto/anti-alucinacao";
import {
  montarSystemComConhecimento,
  type TrechoParaCopiloto,
} from "@/lib/ai/copiloto/conhecimento";

export interface MensagemParaCopiloto {
  direction: string;
  body: string | null;
}

export interface CopilotLlmResultado {
  texto: string;
  model?: string | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
}

export type CopilotLlm = (input: {
  historico: MensagemParaCopiloto[];
  system: string;
}) => Promise<CopilotLlmResultado>;

export type ResultadoDoCopiloto =
  | { ok: true; suggestion: CopilotSuggestionRow; deduped: boolean }
  | { ok: false; reason: "mode_off" | "empty" | "parse" | "error"; message: string };

const SYSTEM_COPILOTO =
  "Você é um assistente do ATENDENTE, não fala com o cliente. " +
  "Resuma só fatos ditos na conversa. Não invente preço, nome, prazo nem produto. " +
  "Se a informação não estiver no histórico, omita. " +
  "Responda APENAS um JSON com as chaves: " +
  "summary (string), intent (PRICE|PRODUCT_INFO|DEMO|SUPPORT|COMPLAINT|PAYMENT|HUMAN_REQUEST|FOLLOW_UP|OTHER), " +
  "suggestedReply (string, rascunho para o atendente editar), " +
  "suggestedNextAction (string ou null), extractedFields (objeto string→string), " +
  "confidence (número 0 a 1). Sem markdown.";

export async function gerarSugestaoDoCopiloto(input: {
  db: Queryable;
  organizationId: string;
  conversationId: string;
  contactId: string | null;
  agentId?: string | null;
  inboundMessageId: string;
  historico: MensagemParaCopiloto[];
  politica: AiExecutionPolicy;
  force?: boolean;
  overlay?: OverlayDoCopiloto;
  /**
   * Trechos já recuperados para ESTE tenant. `undefined` = chamador antigo
   * sem retrieval (testes herdados). `[]` = buscou e não achou.
   */
  trechos?: TrechoParaCopiloto[];
  llm: CopilotLlm;
}): Promise<ResultadoDoCopiloto> {
  if (!input.politica.suggestion_allowed) {
    return { ok: false, reason: "mode_off", message: input.politica.reason };
  }

  if (!input.force) {
    const existente = await buscarSugestaoDaMensagem(input.db, {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      inboundMessageId: input.inboundMessageId,
    });
    if (existente && existente.status !== "discarded") {
      registrarExecucaoDoCopiloto({
        organization_id: input.organizationId,
        conversation_id: input.conversationId,
        inbound_message_id: input.inboundMessageId,
        deduped: true,
      });
      return { ok: true, suggestion: existente, deduped: true };
    }
  }

  if (input.historico.length === 0) {
    return { ok: false, reason: "empty", message: "Conversa sem mensagens para resumir." };
  }

  const overlay = input.overlay ?? { instruction: null, fieldKeys: [], fieldLabels: [] };
  const ultimaPergunta = [...input.historico]
    .reverse()
    .find((m) => m.direction === "inbound" && (m.body ?? "").trim())?.body;
  const trechos = input.trechos;
  const recusarGestao =
    perguntaPedeDadoGestao(ultimaPergunta) && !overlay.moopeFatos;
  const recusar =
    recusarGestao ||
    (trechos !== undefined && deveRecusarInventar(ultimaPergunta, trechos.length));

  let parsed;
  let bruto: CopilotLlmResultado = {
    texto: "",
    model: recusar ? "recusa-sem-fonte" : null,
    prompt_tokens: 0,
    completion_tokens: 0,
  };

  if (recusar) {
    parsed = {
      summary: recusarGestao
        ? "O atendente perguntou dado operacional da Gestão sem fonte viva."
        : "O cliente pediu um dado que não está no conhecimento da empresa.",
      intent: recusarGestao ? ("OTHER" as const) : ("PRICE" as const),
      suggestedReply: recusarGestao ? NAO_CONSEGUI_CONSULTAR_GESTAO : RASCUNHO_SEM_FONTE,
      suggestedNextAction: recusarGestao
        ? "Tentar consultar a Gestão de novo"
        : "Confirmar com a equipe antes de responder",
      extractedFields: {},
      confidence: 0.2,
    };
  } else {
    const system =
      trechos !== undefined
        ? montarSystemComConhecimento(SYSTEM_COPILOTO, overlay, trechos)
        : montarSystemDoCopiloto(SYSTEM_COPILOTO, overlay);
    try {
      bruto = await input.llm({ historico: input.historico, system });
    } catch (err) {
      return {
        ok: false,
        reason: "error",
        message: err instanceof Error ? err.message : "falha no modelo",
      };
    }
    parsed = parsearSugestao(bruto.texto);
    if (!parsed) {
      return { ok: false, reason: "parse", message: "A IA não devolveu uma sugestão legível." };
    }
    parsed.extractedFields = filtrarCamposExtraidos(parsed.extractedFields, overlay.fieldKeys);
  }

  const { row, created } = await gravarSugestao(input.db, {
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    contactId: input.contactId,
    agentId: input.agentId ?? null,
    inboundMessageId: input.inboundMessageId,
    suggestion: parsed,
    model: bruto.model ?? null,
    promptTokens: bruto.prompt_tokens ?? null,
    completionTokens: bruto.completion_tokens ?? null,
    force: input.force === true,
  });

  registrarExecucaoDoCopiloto({
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    agent_id: input.agentId ?? null,
    model: bruto.model ?? null,
    prompt_tokens: bruto.prompt_tokens ?? null,
    completion_tokens: bruto.completion_tokens ?? null,
    inbound_message_id: input.inboundMessageId,
    deduped: !created,
    force: input.force === true,
  });

  return { ok: true, suggestion: row, deduped: !created };
}

export function parsearSugestao(texto: string): CopilotSuggestion | null {
  const json = extrairJson(texto);
  if (!json) return null;
  const r = copilotSuggestionSchema.safeParse(json);
  return r.success ? r.data : null;
}

function extrairJson(texto: string): unknown {
  const cerca = texto.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cru = (cerca?.[1] ?? texto).trim();
  const ini = cru.indexOf("{");
  const fim = cru.lastIndexOf("}");
  if (ini < 0 || fim <= ini) return null;
  try {
    return JSON.parse(cru.slice(ini, fim + 1)) as unknown;
  } catch {
    return null;
  }
}
