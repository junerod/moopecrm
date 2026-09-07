import type { Queryable } from "@/lib/agent-engine/queue/queue";
import type { CopilotIntent, CopilotSuggestion, CopilotSuggestionStatus } from "./schema";

export interface CopilotSuggestionRow {
  id: string;
  organization_id: string;
  conversation_id: string;
  contact_id: string | null;
  agent_id: string | null;
  inbound_message_id: string;
  summary: string;
  intent: CopilotIntent;
  suggested_reply: string;
  suggested_next_action: string | null;
  extracted_fields: Record<string, string>;
  confidence: number;
  status: CopilotSuggestionStatus;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

export async function buscarSugestaoDaMensagem(
  db: Queryable,
  ids: { organizationId: string; conversationId: string; inboundMessageId: string },
): Promise<CopilotSuggestionRow | null> {
  const { rows } = await db.query<CopilotSuggestionRow>(
    `select id, organization_id, conversation_id, contact_id, agent_id,
            inbound_message_id, summary, intent, suggested_reply, suggested_next_action,
            extracted_fields, confidence, status, model, prompt_tokens, completion_tokens
       from ai_copilot_suggestions
      where organization_id = $1 and conversation_id = $2 and inbound_message_id = $3`,
    [ids.organizationId, ids.conversationId, ids.inboundMessageId],
  );
  return rows[0] ?? null;
}

export async function buscarSugestaoAtual(
  db: Queryable,
  ids: { organizationId: string; conversationId: string },
): Promise<CopilotSuggestionRow | null> {
  const { rows } = await db.query<CopilotSuggestionRow>(
    `select id, organization_id, conversation_id, contact_id, agent_id,
            inbound_message_id, summary, intent, suggested_reply, suggested_next_action,
            extracted_fields, confidence, status, model, prompt_tokens, completion_tokens
       from ai_copilot_suggestions
      where organization_id = $1 and conversation_id = $2
      order by created_at desc
      limit 1`,
    [ids.organizationId, ids.conversationId],
  );
  return rows[0] ?? null;
}

export async function gravarSugestao(
  db: Queryable,
  input: {
    organizationId: string;
    conversationId: string;
    contactId: string | null;
    agentId: string | null;
    inboundMessageId: string;
    suggestion: CopilotSuggestion;
    model: string | null;
    promptTokens: number | null;
    completionTokens: number | null;
    force: boolean;
  },
): Promise<{ row: CopilotSuggestionRow; created: boolean }> {
  if (input.force) {
    const { rows } = await db.query<CopilotSuggestionRow>(
      `insert into ai_copilot_suggestions (
         organization_id, conversation_id, contact_id, agent_id, inbound_message_id,
         summary, intent, suggested_reply, suggested_next_action, extracted_fields,
         confidence, status, model, prompt_tokens, completion_tokens, updated_at
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ready',$12,$13,$14, now())
       on conflict (organization_id, conversation_id, inbound_message_id)
       do update set
         summary = excluded.summary,
         intent = excluded.intent,
         suggested_reply = excluded.suggested_reply,
         suggested_next_action = excluded.suggested_next_action,
         extracted_fields = excluded.extracted_fields,
         confidence = excluded.confidence,
         status = 'ready',
         model = excluded.model,
         prompt_tokens = excluded.prompt_tokens,
         completion_tokens = excluded.completion_tokens,
         agent_id = excluded.agent_id,
         updated_at = now()
       returning id, organization_id, conversation_id, contact_id, agent_id,
                 inbound_message_id, summary, intent, suggested_reply, suggested_next_action,
                 extracted_fields, confidence, status, model, prompt_tokens, completion_tokens`,
      [
        input.organizationId,
        input.conversationId,
        input.contactId,
        input.agentId,
        input.inboundMessageId,
        input.suggestion.summary,
        input.suggestion.intent,
        input.suggestion.suggestedReply,
        input.suggestion.suggestedNextAction,
        JSON.stringify(input.suggestion.extractedFields),
        input.suggestion.confidence,
        input.model,
        input.promptTokens,
        input.completionTokens,
      ],
    );
    return { row: must(rows), created: true };
  }

  const { rows } = await db.query<CopilotSuggestionRow>(
    `insert into ai_copilot_suggestions (
       organization_id, conversation_id, contact_id, agent_id, inbound_message_id,
       summary, intent, suggested_reply, suggested_next_action, extracted_fields,
       confidence, status, model, prompt_tokens, completion_tokens
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ready',$12,$13,$14)
     on conflict (organization_id, conversation_id, inbound_message_id)
     do nothing
     returning id, organization_id, conversation_id, contact_id, agent_id,
               inbound_message_id, summary, intent, suggested_reply, suggested_next_action,
               extracted_fields, confidence, status, model, prompt_tokens, completion_tokens`,
    [
      input.organizationId,
      input.conversationId,
      input.contactId,
      input.agentId,
      input.inboundMessageId,
      input.suggestion.summary,
      input.suggestion.intent,
      input.suggestion.suggestedReply,
      input.suggestion.suggestedNextAction,
      JSON.stringify(input.suggestion.extractedFields),
      input.suggestion.confidence,
      input.model,
      input.promptTokens,
      input.completionTokens,
    ],
  );
  if (rows[0]) return { row: rows[0], created: true };
  const existente = await buscarSugestaoDaMensagem(db, {
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    inboundMessageId: input.inboundMessageId,
  });
  if (!existente) {
    throw new Error("sugestão conflitante não encontrada após ON CONFLICT");
  }
  return { row: existente, created: false };
}

export async function marcarSugestao(
  db: Queryable,
  ids: { organizationId: string; suggestionId: string; status: CopilotSuggestionStatus },
): Promise<CopilotSuggestionRow | null> {
  const { rows } = await db.query<CopilotSuggestionRow>(
    `update ai_copilot_suggestions
        set status = $3, updated_at = now()
      where organization_id = $1 and id = $2
      returning id, organization_id, conversation_id, contact_id, agent_id,
                inbound_message_id, summary, intent, suggested_reply, suggested_next_action,
                extracted_fields, confidence, status, model, prompt_tokens, completion_tokens`,
    [ids.organizationId, ids.suggestionId, ids.status],
  );
  return rows[0] ?? null;
}

function must(rows: CopilotSuggestionRow[]): CopilotSuggestionRow {
  const row = rows[0];
  if (!row) throw new Error("ai_copilot_suggestions: insert/update sem linha");
  return row;
}
