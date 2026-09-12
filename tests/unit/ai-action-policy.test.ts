/**
 * Etapa 2.5 — Action Policy. As três perguntas não se misturam:
 * comando / execução / efeito.
 */
import { describe, expect, it } from "vitest";

import { authorizeAiAction } from "@/lib/ai/acoes/autorizar";
import { resolveAiExecutionPolicy, modoApresentado } from "@/lib/ai/execucao/politica";

const EXEC_OK = resolveAiExecutionPolicy({
  globalOff: false,
  tenantMode: "controlled",
  channelOff: false,
  agentOff: false,
  conversationDeny: null,
});

describe("TESTE 6 — CONTROLLED send_message sem autorização", () => {
  it("DENY", () => {
    const r = authorizeAiAction({
      action: "send_message",
      ai_mode: "controlled",
      execution: EXEC_OK,
      configured: { allow: [], confirm: [] },
    });
    expect(r.verdict).toBe("DENY");
  });
});

describe("TESTE 7 — CONTROLLED move_lead_stage pede confirmação", () => {
  it("REQUIRE_CONFIRMATION mesmo sem lista explícita", () => {
    const r = authorizeAiAction({
      action: "move_lead_stage",
      ai_mode: "controlled",
      execution: EXEC_OK,
      configured: { allow: [], confirm: [] },
    });
    expect(r.verdict).toBe("REQUIRE_CONFIRMATION");
  });

  it("allowlist explícita libera", () => {
    const r = authorizeAiAction({
      action: "move_lead_stage",
      ai_mode: "controlled",
      execution: EXEC_OK,
      configured: { allow: ["move_lead_stage"], confirm: [] },
    });
    expect(r.verdict).toBe("ALLOW");
  });
});

describe("matriz OFF / COPILOT / CONTROLLED / AUTONOMOUS", () => {
  it("OFF nega tudo", () => {
    expect(
      authorizeAiAction({ action: "summarize", ai_mode: "off" }).verdict,
    ).toBe("DENY");
    expect(
      authorizeAiAction({ action: "send_message", ai_mode: "off" }).verdict,
    ).toBe("DENY");
  });

  it("COPILOT permite ler/sugerir e nega side effect", () => {
    expect(
      authorizeAiAction({ action: "suggest_reply", ai_mode: "copilot", execution: EXEC_OK }).verdict,
    ).toBe("ALLOW");
    expect(
      authorizeAiAction({ action: "add_tag", ai_mode: "copilot" }).verdict,
    ).toBe("DENY");
    expect(
      authorizeAiAction({ action: "create_task", ai_mode: "copilot" }).verdict,
    ).toBe("DENY");
    expect(
      authorizeAiAction({ action: "operational_moope_action", ai_mode: "copilot" }).verdict,
    ).toBe("DENY");
    expect(
      authorizeAiAction({ action: "campaign_dispatch", ai_mode: "copilot" }).verdict,
    ).toBe("DENY");
  });

  it("campanha comercial nunca dispara sozinha", () => {
    expect(
      authorizeAiAction({ action: "campaign_dispatch", ai_mode: "controlled" }).verdict,
    ).toBe("REQUIRE_CONFIRMATION");
    expect(
      authorizeAiAction({
        action: "campaign_dispatch",
        ai_mode: "autonomous",
        configured: { allow: ["campaign_dispatch"], confirm: [] },
      }).verdict,
    ).toBe("DENY");
  });

  it("CONTROLLED: ação leve sem config é DENY — ausência não é ALLOW", () => {
    expect(
      authorizeAiAction({
        action: "add_tag",
        ai_mode: "controlled",
        configured: { allow: [], confirm: [] },
      }).verdict,
    ).toBe("DENY");
  });

  it("AUTONOMOUS preserva capacidade, ainda sujeito a kill", () => {
    const auto = resolveAiExecutionPolicy({
      globalOff: false,
      tenantMode: "autonomous",
      channelOff: false,
      agentOff: false,
      conversationDeny: null,
    });
    expect(
      authorizeAiAction({ action: "send_message", ai_mode: "autonomous", execution: auto }).verdict,
    ).toBe("ALLOW");
    const morto = resolveAiExecutionPolicy({
      globalOff: true,
      tenantMode: "autonomous",
      channelOff: false,
      agentOff: false,
      conversationDeny: null,
    });
    expect(
      authorizeAiAction({ action: "send_message", ai_mode: "autonomous", execution: morto }).verdict,
    ).toBe("DENY");
  });
});

describe("TESTE 11 — GLOBAL OFF + tenant AUTONOMOUS", () => {
  it("efetivo OFF com motivo de kill global", () => {
    const p = resolveAiExecutionPolicy({
      globalOff: true,
      tenantMode: "autonomous",
      channelOff: false,
      agentOff: false,
      conversationDeny: null,
    });
    expect(p.ai_mode).toBe("autonomous");
    expect(modoApresentado(p)).toBe("off");
    expect(p.kill_source).toBe("global");
    expect(p.suggestion_allowed).toBe(false);
    expect(p.reason).toMatch(/GLOBAL|desativ/i);
  });
});
