import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { BOT_RECEPCAO_KEY, grafoBotRecepcao } from "./bot-semente";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";

describe("grafoBotRecepcao", () => {
  it("publica no validador (draft do pack)", () => {
    const graph = grafoBotRecepcao();
    const v = validateFlowForPublish(graph);
    expect(v.ok, v.ok ? "" : v.errors.map((e) => e.message).join("; ")).toBe(true);
    expect(graph.nodes.some((n) => n.type === "menu")).toBe(true);
    expect(graph.nodes.some((n) => n.type === "horario")).toBe(true);
    expect(graph.nodes.some((n) => n.type === "faq")).toBe(true);
  });
});

describe("garantirBotRecepcao no instalador — sabote e este teste falha", () => {
  it("nasce draft purpose=bot e não sobrescreve se já existe", () => {
    const src = readFileSync("lib/business-packs/aplicar.ts", "utf8");
    const fn = src.slice(src.indexOf("async function garantirBotRecepcao"));
    expect(fn).toMatch(/purpose:\s*"bot"/);
    expect(fn).toMatch(/status:\s*"draft"/);
    expect(fn).not.toMatch(/status:\s*"active"/);
    expect(fn).toMatch(/if \(ids\[BOT_RECEPCAO_KEY\]\)/);
    expect(fn).toMatch(/eq\("name", BOT_RECEPCAO_NOME\)/);
    expect(BOT_RECEPCAO_KEY).toBe("bot_recepcao");
  });
});
