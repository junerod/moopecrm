import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { authorizeAiAction } from "./autorizar";

describe("create_task aponta para demandas, não para tabela tasks", () => {
  const fonte = readFileSync("lib/ai/acoes/executar.ts", "utf8");

  it("executor grava proximo_passo em demandas", () => {
    expect(fonte).toMatch(/requested_action === "create_task"/);
    expect(fonte).toMatch(/insert into demandas/);
    expect(fonte).toMatch(/proximo_passo/);
    expect(fonte).not.toMatch(/insert into tasks/);
  });

  it("COPILOT continua sem side effect", () => {
    const d = authorizeAiAction({ action: "create_task", ai_mode: "copilot" });
    expect(d.verdict).toBe("DENY");
  });

  it("CONTROLLED sem allowlist não cria sozinho", () => {
    const d = authorizeAiAction({ action: "create_task", ai_mode: "controlled" });
    expect(d.verdict).toBe("DENY");
  });

  it("AUTONOMOUS pode seguir (policy atual)", () => {
    const d = authorizeAiAction({ action: "create_task", ai_mode: "autonomous" });
    expect(d.verdict).toBe("ALLOW");
  });
});
