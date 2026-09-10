import { describe, expect, it } from "vitest";

import type { Queryable } from "@/lib/agent-engine/queue/queue";
import { gerarSugestaoDoCopiloto, parsearSugestao } from "@/lib/ai/copiloto/gerar";
import { RASCUNHO_SEM_FONTE } from "@/lib/ai/copiloto/anti-alucinacao";
import { resolveAiExecutionPolicy } from "@/lib/ai/execucao/politica";

const COPILOT = resolveAiExecutionPolicy({
  globalOff: false,
  tenantMode: "copilot",
  channelOff: false,
  agentOff: false,
  conversationDeny: null,
});

const OFF = resolveAiExecutionPolicy({
  globalOff: false,
  tenantMode: "off",
  channelOff: false,
  agentOff: false,
  conversationDeny: null,
});

const JSON_OK = JSON.stringify({
  summary: "Cliente perguntou preço e ainda não recebeu proposta.",
  intent: "PRICE",
  suggestedReply: "Posso te passar os planos assim que confirmar o volume.",
  suggestedNextAction: "Pedir quantidade",
  extractedFields: {},
  confidence: 0.8,
});

function dbComMemoria(existente: Record<string, unknown> | null = null) {
  const gravados: unknown[] = [];
  return {
    gravados,
    db: {
      query: async (sql: string, values?: unknown[]) => {
        if (sql.includes("from ai_copilot_suggestions") && sql.includes("inbound_message_id")) {
          return { rows: existente ? [existente] : [] };
        }
        if (sql.includes("insert into ai_copilot_suggestions")) {
          const row = {
            id: "sug-1",
            organization_id: values?.[0],
            conversation_id: values?.[1],
            contact_id: values?.[2],
            agent_id: values?.[3],
            inbound_message_id: values?.[4],
            summary: values?.[5],
            intent: values?.[6],
            suggested_reply: values?.[7],
            suggested_next_action: values?.[8],
            extracted_fields: {},
            confidence: values?.[10],
            status: "ready",
            model: values?.[11],
            prompt_tokens: values?.[12],
            completion_tokens: values?.[13],
          };
          gravados.push(row);
          return { rows: [row] };
        }
        return { rows: [] };
      },
    } as unknown as Queryable,
  };
}

describe("TESTE 1 — OFF não gera Copilot", () => {
  it("mode_off sem chamar o modelo", async () => {
    let chamadas = 0;
    const { db, gravados } = dbComMemoria();
    const r = await gerarSugestaoDoCopiloto({
      db,
      organizationId: "org",
      conversationId: "conv",
      contactId: "ct",
      inboundMessageId: "msg",
      historico: [{ direction: "inbound", body: "oi" }],
      politica: OFF,
      llm: async () => {
        chamadas += 1;
        return { texto: JSON_OK };
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("mode_off");
    expect(chamadas).toBe(0);
    expect(gravados).toHaveLength(0);
  });
});

describe("TESTE 2 e 3 — COPILOT gera sugestão sem envio", () => {
  it("persiste rascunho e não tem send no contrato", async () => {
    const { db, gravados } = dbComMemoria();
    const r = await gerarSugestaoDoCopiloto({
      db,
      organizationId: "org",
      conversationId: "conv",
      contactId: "ct",
      inboundMessageId: "msg",
      historico: [{ direction: "inbound", body: "quanto custa?" }],
      politica: COPILOT,
      llm: async () => ({ texto: JSON_OK, model: "test", prompt_tokens: 10, completion_tokens: 20 }),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.suggestion.suggested_reply).toMatch(/planos/i);
      expect(r.suggestion.status).toBe("ready");
      expect(r.deduped).toBe(false);
    }
    expect(gravados).toHaveLength(1);
    expect(JSON.stringify(gravados[0])).not.toMatch(/outbound|send_message/);
  });
});

describe("TESTE 12 — humano assume no meio: sem side effect", () => {
  it("sugestão pode terminar; política de conversa não mata o persistir", async () => {
    const humana = resolveAiExecutionPolicy({
      globalOff: false,
      tenantMode: "copilot",
      channelOff: false,
      agentOff: false,
      conversationDeny: { codigo: "DENY_HUMAN_ACTIVE", motivo: "humano no comando" },
    });
    expect(humana.suggestion_allowed).toBe(true);
    expect(humana.side_effects_allowed).toBe(false);
    const { db } = dbComMemoria();
    const r = await gerarSugestaoDoCopiloto({
      db,
      organizationId: "org",
      conversationId: "conv",
      contactId: "ct",
      inboundMessageId: "msg",
      historico: [{ direction: "inbound", body: "oi" }],
      politica: humana,
      llm: async () => ({ texto: JSON_OK }),
    });
    expect(r.ok).toBe(true);
  });
});

describe("TESTE 13 — mesma last_message_id não gera duas", () => {
  it("dedup devolve a existente sem chamar o modelo", async () => {
    let chamadas = 0;
    const existente = {
      id: "ja",
      organization_id: "org",
      conversation_id: "conv",
      inbound_message_id: "msg",
      summary: "já tinha",
      intent: "OTHER",
      suggested_reply: "rascunho antigo",
      suggested_next_action: null,
      extracted_fields: {},
      confidence: 0.4,
      status: "ready",
      contact_id: null,
      agent_id: null,
      model: null,
      prompt_tokens: null,
      completion_tokens: null,
    };
    const { db } = dbComMemoria(existente);
    const r = await gerarSugestaoDoCopiloto({
      db,
      organizationId: "org",
      conversationId: "conv",
      contactId: "ct",
      inboundMessageId: "msg",
      historico: [{ direction: "inbound", body: "oi" }],
      politica: COPILOT,
      llm: async () => {
        chamadas += 1;
        return { texto: JSON_OK };
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.deduped).toBe(true);
      expect(r.suggestion.id).toBe("ja");
    }
    expect(chamadas).toBe(0);
  });
});

describe("Copilot + RAG — não inventa preço ausente", () => {
  it("sem trecho, não chama o modelo e admite a ausência", async () => {
    let chamadas = 0;
    const { db, gravados } = dbComMemoria();
    const r = await gerarSugestaoDoCopiloto({
      db,
      organizationId: "org-a",
      conversationId: "conv",
      contactId: "ct",
      inboundMessageId: "msg-zeta",
      historico: [{ direction: "inbound", body: "Quanto custa o Produto Zeta?" }],
      politica: COPILOT,
      trechos: [],
      llm: async () => {
        chamadas += 1;
        return { texto: JSON.stringify({ ...JSON.parse(JSON_OK), suggestedReply: "O Produto Zeta custa R$ 50." }) };
      },
    });
    expect(r.ok).toBe(true);
    expect(chamadas).toBe(0);
    if (r.ok) expect(r.suggestion.suggested_reply).toBe(RASCUNHO_SEM_FONTE);
    expect(JSON.stringify(gravados[0])).not.toMatch(/R\$ ?50/);
  });

  it("com trecho do tenant, o system leva só esse texto", async () => {
    let systemVisto = "";
    const { db } = dbComMemoria();
    await gerarSugestaoDoCopiloto({
      db,
      organizationId: "org-a",
      conversationId: "conv",
      contactId: "ct",
      inboundMessageId: "msg-alfa",
      historico: [{ direction: "inbound", body: "Quanto custa o Produto Alfa?" }],
      politica: COPILOT,
      trechos: [{ content: "Produto Alfa custa R$ 123." }],
      llm: async ({ system }) => {
        systemVisto = system;
        return { texto: JSON_OK };
      },
    });
    expect(systemVisto).toMatch(/R\$ 123/);
    expect(systemVisto).not.toMatch(/R\$ 999/);
  });
});

describe("parse da saída", () => {
  it("não inventa intent fora do vocabulário", () => {
    expect(parsearSugestao('{"summary":"x","intent":"MOOPE_FLEET"}')).toBeNull();
    expect(parsearSugestao(JSON_OK)?.intent).toBe("PRICE");
  });
});
