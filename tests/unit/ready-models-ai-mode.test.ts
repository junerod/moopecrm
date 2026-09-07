import { describe, expect, it } from "vitest";

import { authorizeAiAction } from "@/lib/ai/acoes/autorizar";
import { resolveAiExecutionPolicy } from "@/lib/ai/execucao/politica";

const EXEC_COPILOT = resolveAiExecutionPolicy({
  globalOff: false,
  tenantMode: "copilot",
  channelOff: false,
  agentOff: false,
  conversationDeny: null,
});
const EXEC_OFF = resolveAiExecutionPolicy({
  globalOff: false,
  tenantMode: "off",
  channelOff: false,
  agentOff: false,
  conversationDeny: null,
});
const EXEC_CONTROLLED = resolveAiExecutionPolicy({
  globalOff: false,
  tenantMode: "controlled",
  channelOff: false,
  agentOff: false,
  conversationDeny: null,
});
const EXEC_AUTO = resolveAiExecutionPolicy({
  globalOff: false,
  tenantMode: "autonomous",
  channelOff: false,
  agentOff: false,
  conversationDeny: null,
});

describe("AI_MODE do Simple Mode — invariantes da fundação", () => {
  it("OFF não vira atendimento automático", () => {
    expect(
      authorizeAiAction({ action: "send_message", ai_mode: "off", execution: EXEC_OFF }).verdict,
    ).toBe("DENY");
    expect(EXEC_OFF.suggestion_allowed).toBe(false);
    expect(EXEC_OFF.side_effects_allowed).toBe(false);
  });

  it("COPILOT sugere e não envia", () => {
    expect(EXEC_COPILOT.suggestion_allowed).toBe(true);
    expect(
      authorizeAiAction({ action: "send_message", ai_mode: "copilot", execution: EXEC_COPILOT })
        .verdict,
    ).toBe("DENY");
    expect(
      authorizeAiAction({ action: "suggest_reply", ai_mode: "copilot", execution: EXEC_COPILOT })
        .verdict,
    ).toBe("ALLOW");
  });

  it("CONTROLLED: send_message deny; move_lead_stage pede confirmação", () => {
    expect(
      authorizeAiAction({
        action: "send_message",
        ai_mode: "controlled",
        execution: EXEC_CONTROLLED,
      }).verdict,
    ).toBe("DENY");
    expect(
      authorizeAiAction({
        action: "move_lead_stage",
        ai_mode: "controlled",
        execution: EXEC_CONTROLLED,
      }).verdict,
    ).toBe("REQUIRE_CONFIRMATION");
    expect(
      authorizeAiAction({
        action: "call_external_api",
        ai_mode: "controlled",
        execution: EXEC_CONTROLLED,
      }).verdict,
    ).toBe("DENY");
    expect(
      authorizeAiAction({
        action: "operational_moope_action",
        ai_mode: "controlled",
        execution: EXEC_CONTROLLED,
      }).verdict,
    ).toBe("DENY");
  });

  it("AUTONOMOUS não ganhou permissão extra por Ready Model", () => {
    const a = authorizeAiAction({
      action: "send_message",
      ai_mode: "autonomous",
      execution: EXEC_AUTO,
    });
    // A fundação já autoriza AUTONOMOUS a seguir para guardrails — Ready Model
    // não muda esta função. O que não pode é o instalador gravar allowlist.
    expect(a.verdict).toBe("ALLOW");
    expect(a.reason).not.toMatch(/ready model|locacao|advocacia/i);
  });
});
