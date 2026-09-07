import { describe, expect, it } from "vitest";

import { turnPayloadExtras } from "./engine";
import { TEMPLATE_DE_TESTE } from "./fluxo-fixtures";
import type { FlowNode } from "./graph-schema";

describe("turnPayloadExtras — action de template vs IA", () => {
  it("D. action template leva template_id e mode, sem prompt_hint", () => {
    const node: FlowNode = {
      id: "a1",
      type: "action",
      label: "Lembrete",
      position: { x: 0, y: 0 },
      config: { mode: "template", template_id: TEMPLATE_DE_TESTE },
    };
    expect(turnPayloadExtras(node, [])).toEqual({
      template_id: TEMPLATE_DE_TESTE,
      mode: "template",
    });
  });

  it("B. action ai_message leva prompt_hint, sem template_id", () => {
    const node: FlowNode = {
      id: "a1",
      type: "action",
      label: "IA",
      position: { x: 0, y: 0 },
      config: { mode: "ai_message", prompt_hint: "escreva um lembrete" },
    };
    expect(turnPayloadExtras(node, [])).toEqual({ prompt_hint: "escreva um lembrete" });
  });
});
