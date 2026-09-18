import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { enrollmentDeBotCalaIa } from "./bot-intercept";

describe("enrollmentDeBotCalaIa", () => {
  it("cala a IA só com enrollment de bot vivo", () => {
    expect(enrollmentDeBotCalaIa([{ purpose: "bot", status: "waiting_reply" }])).toBe(true);
    expect(enrollmentDeBotCalaIa([{ purpose: "followup", status: "waiting_reply" }])).toBe(false);
    expect(enrollmentDeBotCalaIa([{ purpose: "bot", status: "completed" }])).toBe(false);
    expect(enrollmentDeBotCalaIa([])).toBe(false);
  });
});

describe("inbound-turn chama a guarda — sabote e este teste falha", () => {
  it("createInboundTurnHandler consulta contatoTemBotAtivo antes de runAgentTurn", () => {
    const src = readFileSync("lib/agent-engine/agent/inbound-turn.ts", "utf8");
    const handler = src.slice(src.indexOf("export function createInboundTurnHandler"));
    expect(handler).toMatch(/contatoTemBotAtivo/);
    expect(handler).toMatch(/enrollBotsInboundSePreciso/);
    const semGuarda = handler.replace(/if \(await contatoTemBotAtivo[\s\S]*?return;\s*\}/, "");
    expect(semGuarda).not.toMatch(/contatoTemBotAtivo/);
    expect(handler.indexOf("contatoTemBotAtivo")).toBeLessThan(handler.indexOf("runAgentTurn"));
  });
});
