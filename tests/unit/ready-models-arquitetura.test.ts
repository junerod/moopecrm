/**
 * Ready Model não entra no runtime. Se alguém escrever `if (modelo === "locacao")`
 * num caminho de envio/ingestão, este teste pega.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CAMINHOS_CRITICOS = [
  "lib/agent-engine/agent/inbound-turn.ts",
  "lib/agent-engine/guardrails/before-send.ts",
  "lib/inbox/comando-da-conversa.ts",
  "lib/agent-engine/channel-adapter.ts",
  "lib/automation/engine.ts",
  "lib/followup/engine.ts",
  "lib/followup/reactivity.ts",
  "lib/ai/copiloto/gerar.ts",
  "lib/agent-engine/agent/copilot-turn.ts",
];

const PROIBIDO =
  /\b(locacao|advocacia|comercial|servicos|personalizado|locadora)\s*===|\.id\s*===\s*["']locacao|if\s*\(\s*(modelo|readyModel|perfil)/i;

describe("runtime não ramifica por Ready Model", () => {
  it.each(CAMINHOS_CRITICOS)("%s não cita id de Ready Model", (path) => {
    const src = readFileSync(path, "utf8");
    expect(src).not.toMatch(PROIBIDO);
    expect(src).not.toMatch(/ready-models\/modelos/);
  });
});
