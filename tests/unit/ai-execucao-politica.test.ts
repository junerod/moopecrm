/**
 * Etapa 2 — modos de IA, kill hierárquico, intenção de envio e jobs.
 * Os 15 testes de aceite vivem aqui, contra funções puras + fakes.
 */
import { describe, expect, it, vi } from "vitest";

import { decidirEfeitoDaIa, capacidadesDoModo, lerAiMode, modoEfetivo } from "@/lib/ai/execucao/modos";
import {
  globalAiExecutionOff,
  resolveAiExecutionPolicy,
  type CamadasDaPolitica,
} from "@/lib/ai/execucao/politica";
import {
  ehEnvioOperacionalMoope,
  envioRespeitaComandoDaConversa,
  resolverIntencaoDeEnvio,
} from "@/lib/ai/execucao/intencao-de-envio";
import { jobFoiInvalidado, ABORT_REQUESTED_PREFIX } from "@/lib/agent-engine/queue/queue";
import { decidirEnvioConversacional } from "@/lib/inbox/comando-da-conversa";
import { settingsDeOrganizacaoNova } from "@/lib/schemas/settings";

const AUTOMATICO: CamadasDaPolitica = {
  globalOff: false,
  tenantMode: "autonomous",
  channelOff: false,
  agentOff: false,
  conversationDeny: null,
};

describe("TESTE 1 — AI_MODE=off não cria trabalho LLM", () => {
  it("OFF: sem LLM, sem side effect, sem enfileirar turno", () => {
    const p = resolveAiExecutionPolicy({ ...AUTOMATICO, tenantMode: "off" });
    expect(p.execution_allowed).toBe(false);
    expect(p.side_effects_allowed).toBe(false);
    expect(p.deve_enfileirar_turno).toBe(false);
    expect(p.suggestion_allowed).toBe(false);
    expect(p.deve_enfileirar_copiloto).toBe(false);
    expect(p.kill_source).toBe("tenant");
    expect(p.capabilities.podeChamarLlm).toBe(false);
  });
});

describe("TESTE 2 — COPILOT gera sugestão sem side effect", () => {
  it("sugestão permitida; enviar/mover/tool negados", () => {
    const p = resolveAiExecutionPolicy({ ...AUTOMATICO, tenantMode: "copilot" });
    expect(p.execution_allowed).toBe(true);
    expect(p.side_effects_allowed).toBe(false);
    expect(p.deve_enfileirar_turno).toBe(false);
    expect(p.suggestion_allowed).toBe(true);
    expect(p.deve_enfileirar_copiloto).toBe(true);

    const sugestao = decidirEfeitoDaIa("copilot", { tipo: "sugerir_resposta" });
    expect(sugestao.permitido).toBe(true);
    if (sugestao.permitido) {
      expect(sugestao.eh_sugestao).toBe(true);
      expect(sugestao.sugestao.lado).toBe("copiloto");
    }

    expect(decidirEfeitoDaIa("copilot", { tipo: "mover_lead" }).permitido).toBe(false);
    expect(decidirEfeitoDaIa("copilot", { tipo: "chamar_tool_externa" }).permitido).toBe(false);
    expect(decidirEfeitoDaIa("copilot", { tipo: "alterar_dado_critico" }).permitido).toBe(false);
    expect(decidirEfeitoDaIa("copilot", { tipo: "tomar_comando" }).permitido).toBe(false);
  });
});

describe("TESTE 3 — COPILOT tenta send_message → DENY", () => {
  it("nega o envio pelo modo, sem precisar do canal", () => {
    const r = decidirEfeitoDaIa("copilot", { tipo: "send_message" });
    expect(r).toEqual({
      permitido: false,
      codigo: "DENY",
      motivo: "AI_MODE=copilot não envia mensagem.",
    });
  });
});

describe("TESTE 4 — AUTONOMOUS continua permitido", () => {
  it("enfileira e autoriza side effect quando o comando é automático", () => {
    const p = resolveAiExecutionPolicy(AUTOMATICO);
    expect(p.ai_mode).toBe("autonomous");
    expect(p.execution_allowed).toBe(true);
    expect(p.side_effects_allowed).toBe(true);
    expect(p.deve_enfileirar_turno).toBe(true);
    expect(p.kill_source).toBeNull();
    expect(decidirEfeitoDaIa("autonomous", { tipo: "send_message" }).permitido).toBe(true);
  });
});

describe("TESTE 5 — AUTONOMOUS + humano assume = Etapa 1", () => {
  it("o predicado da Etapa 1 ainda cala, e a política herda o kill", () => {
    const comando = decidirEnvioConversacional({
      status: "claimed",
      assigned_to_user_id: "user-1",
      assignee_kind: "user",
      bot_silenced_until: "infinity",
      force_human: false,
      is_blocked: false,
    });
    expect(comando.permitido).toBe(false);
    if (!comando.permitido) expect(comando.codigo).toBe("DENY_HUMAN_ACTIVE");

    const p = resolveAiExecutionPolicy({
      ...AUTOMATICO,
      conversationDeny: comando.permitido ? null : { codigo: comando.codigo, motivo: comando.motivo },
    });
    expect(p.side_effects_allowed).toBe(false);
    expect(p.deve_enfileirar_turno).toBe(false);
    expect(p.kill_source).toBe("conversation");
  });
});

describe("TESTE 6 e 7 — jobs pending/running", () => {
  it("pending vira failed; running só ganha marca de abort", async () => {
    const { invalidatePendingConversationalJobs, requestAbortOnRunningConversationalJobs } =
      await import("@/lib/agent-engine/queue/queue");

    const updates: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      query: async (sql: string, values?: unknown[]) => {
        updates.push({ sql, values: values ?? [] });
        return { rows: [{ id: "job-1" }] };
      },
    } as unknown as import("@/lib/agent-engine/queue/queue").Queryable;

    const pending = await invalidatePendingConversationalJobs(db, {
      organizationId: "org",
      contactId: "ct",
      reason: "abort_requested:human_takeover",
    });
    const running = await requestAbortOnRunningConversationalJobs(db, {
      organizationId: "org",
      contactId: "ct",
      reason: "abort_requested:human_takeover",
    });
    expect(pending).toBe(1);
    expect(running).toBe(1);
    expect(updates[0]?.sql).toMatch(/status = 'failed'/);
    expect(updates[0]?.sql).toMatch(/status = 'pending'/);
    expect(updates[1]?.sql).not.toMatch(/status = 'failed'/);
    expect(updates[1]?.sql).toMatch(/status = 'running'/);
    expect(updates[1]?.values[2]).toMatch(/^abort_requested:/);
  });
});

describe("TESTE 8 — devolver não ressuscita job invalidado", () => {
  it("a marca de abort sobrevive à leitura pós-devolução", () => {
    expect(jobFoiInvalidado(`${ABORT_REQUESTED_PREFIX}human_takeover`)).toBe(true);
    expect(jobFoiInvalidado("visibility timeout excedido")).toBe(false);
    expect(jobFoiInvalidado(null)).toBe(false);
    // Devolver limpa silêncio, não last_error. Job antigo continua morto.
  });
});

describe("TESTE 9 — GLOBAL OFF", () => {
  it("primeiro OFF vence mesmo com tenant autonomous", () => {
    const p = resolveAiExecutionPolicy({ ...AUTOMATICO, globalOff: true });
    expect(p.execution_allowed).toBe(false);
    expect(p.kill_source).toBe("global");
  });

  it("lê as grafias de desligado sem derrubar", () => {
    expect(globalAiExecutionOff("off")).toBe(true);
    expect(globalAiExecutionOff("false")).toBe(true);
    expect(globalAiExecutionOff("on")).toBe(false);
    expect(globalAiExecutionOff("lixo")).toBe(false);
    expect(globalAiExecutionOff(undefined)).toBe(false);
  });
});

describe("TESTE 10 — TENANT OFF", () => {
  it("só o tenant correspondente para", () => {
    const off = resolveAiExecutionPolicy({ ...AUTOMATICO, tenantMode: "off" });
    const on = resolveAiExecutionPolicy(AUTOMATICO);
    expect(off.kill_source).toBe("tenant");
    expect(on.kill_source).toBeNull();
  });
});

describe("TESTE 11 — AGENT OFF", () => {
  it("agente pausado/despublicado cala só aquele agente", () => {
    const p = resolveAiExecutionPolicy({ ...AUTOMATICO, agentOff: true });
    expect(p.kill_source).toBe("agent");
    expect(resolveAiExecutionPolicy(AUTOMATICO).kill_source).toBeNull();
  });
});

describe("TESTE 12 — CONVERSATION pausada", () => {
  it("silêncio sem dono é PAUSED, e a política herda", () => {
    const comando = decidirEnvioConversacional({
      status: "open",
      assigned_to_user_id: null,
      assignee_kind: "ai",
      bot_silenced_until: "infinity",
      force_human: false,
      is_blocked: false,
    });
    expect(comando.permitido).toBe(false);
    if (!comando.permitido) expect(comando.codigo).toBe("DENY_PAUSED");

    const p = resolveAiExecutionPolicy({
      ...AUTOMATICO,
      conversationDeny: { codigo: "DENY_PAUSED", motivo: "pausado" },
    });
    expect(p.kill_source).toBe("conversation");
  });
});

describe("TESTE 13 — MOOPE operacional com humano no comando", () => {
  it("só send_intent explícito operacional_moope libera a exceção", () => {
    expect(ehEnvioOperacionalMoope("operational_moope")).toBe(true);
    expect(ehEnvioOperacionalMoope("campaign_commercial")).toBe(false);
    expect(envioRespeitaComandoDaConversa("campaign_commercial")).toBe(false);
    expect(envioRespeitaComandoDaConversa("operational_moope")).toBe(false);
    expect(
      resolverIntencaoDeEnvio({
        actor: { type: "webhook_source", id: "moope-send" },
        send_intent: "operational_moope",
      }),
    ).toBe("operational_moope");
  });
});

describe("TESTE 14 — MCP crm_send_whatsapp_message respeita o comando", () => {
  it("integration_api passa pelo predicado da Etapa 1", () => {
    expect(envioRespeitaComandoDaConversa("integration_api")).toBe(true);
    const comando = decidirEnvioConversacional({
      status: "claimed",
      assigned_to_user_id: "user-1",
      bot_silenced_until: "infinity",
      force_human: false,
      is_blocked: false,
    });
    expect(comando.permitido).toBe(false);
  });
});

describe("TESTE 15 — webhook_source genérico NÃO herda MOOPE", () => {
  it("sem send_intent, webhook_source é conversacional", () => {
    const intent = resolverIntencaoDeEnvio({
      actor: { type: "webhook_source", id: "regra-qualquer" },
    });
    expect(intent).toBe("conversational_auto");
    expect(ehEnvioOperacionalMoope(intent)).toBe(false);
    expect(envioRespeitaComandoDaConversa(intent)).toBe(true);
  });
});

describe("modelagem — CONTROLLED e orgs novas", () => {
  it("CONTROLLED colapsa para COPILOT, nunca para AUTONOMOUS", () => {
    expect(modoEfetivo("controlled")).toBe("copilot");
    expect(capacidadesDoModo("controlled").podeEnviar).toBe(false);
    const p = resolveAiExecutionPolicy({ ...AUTOMATICO, tenantMode: "controlled" });
    expect(p.side_effects_allowed).toBe(false);
    expect(p.deve_enfileirar_turno).toBe(false);
  });

  it("chave ausente = autonomous (compat); org nova grava off", () => {
    expect(lerAiMode(undefined)).toBe("autonomous");
    expect(lerAiMode("lixo")).toBe("autonomous");
    expect(settingsDeOrganizacaoNova({ plan: "standard" })).toEqual({
      plan: "standard",
      ai_mode: "off",
    });
  });

  it("hierarquia: o primeiro OFF vence (global > tenant > channel > agent)", () => {
    expect(resolveAiExecutionPolicy({ ...AUTOMATICO, globalOff: true, tenantMode: "off" }).kill_source).toBe(
      "global",
    );
    expect(resolveAiExecutionPolicy({ ...AUTOMATICO, tenantMode: "off", channelOff: true }).kill_source).toBe(
      "tenant",
    );
    expect(resolveAiExecutionPolicy({ ...AUTOMATICO, channelOff: true, agentOff: true }).kill_source).toBe(
      "channel",
    );
  });
});

describe("env AI_EXECUTION não derruba o boot", () => {
  it("está no schema como string com default on", async () => {
    const anterior = process.env.AI_EXECUTION;
    process.env.AI_EXECUTION = "lixo-do-operador";
    vi.resetModules();
    const { env } = await import("@/lib/env");
    expect(env.AI_EXECUTION).toBe("lixo-do-operador");
    if (anterior === undefined) delete process.env.AI_EXECUTION;
    else process.env.AI_EXECUTION = anterior;
    vi.resetModules();
  });
});
