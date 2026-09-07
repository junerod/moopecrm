/**
 * TESTE J — webhook duplicado continua sendo processado uma única vez.
 *
 * A Etapa 1 não mexe na ingestão. Este caso só impede que um "conserto"
 * vizinho apague o `23505` que é a idempotência da mensagem.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("TESTE J — idempotência de webhook", () => {
  it("a ingestão WAHA ainda trata unique (organization_id, external_id) como dedup", () => {
    const fonte = readFileSync("lib/waha/ingest.ts", "utf8");
    expect(fonte).toContain('insertErr?.code === "23505"');
    expect(fonte).toMatch(/kind:\s*"dedup"/);
  });

  it("o canal intermediado também curto-circuita 23505", () => {
    const fonte = readFileSync("lib/channels/twilio/ingest.ts", "utf8");
    expect(fonte).toContain('errMsg.code === "23505"');
  });
});
