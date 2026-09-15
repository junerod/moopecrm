import { describe, expect, it } from "vitest";

import {
  AGENT_MODELS,
  agentModelSchema,
  agentPatchSchema,
  modeloInicialDoAgente,
} from "@/lib/ai/guardrails-schema";

describe("modelo do assistente", () => {
  it("aceita GPT — a chave da OpenAI não é enfeite", () => {
    expect(agentModelSchema.parse("openai/gpt-4o-mini")).toBe("openai/gpt-4o-mini");
    expect(agentPatchSchema.parse({ model: "openai/gpt-4o" }).model).toBe("openai/gpt-4o");
    expect(AGENT_MODELS.some((m) => m.startsWith("openai/"))).toBe(true);
  });

  it("não empurra Claude em quem já tem GPT gravado", () => {
    expect(modeloInicialDoAgente("openai/gpt-4o")).toBe("openai/gpt-4o");
    expect(modeloInicialDoAgente("anthropic/claude-sonnet-4-6")).toBe(
      "anthropic/claude-sonnet-4-6",
    );
  });

  it("modelo vazio ou sem provedor não vira Claude", () => {
    expect(modeloInicialDoAgente("")).toBe("openai/gpt-4o-mini");
    expect(modeloInicialDoAgente("sonnet-solto")).toBe("openai/gpt-4o-mini");
  });
});
