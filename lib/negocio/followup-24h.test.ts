import { describe, expect, it } from "vitest";

import { validateFlowForPublish } from "@/lib/followup/validate-publish";

import {
  ehFollowupDeSilencio,
  grafoDeSilencio24h,
  MINUTOS_FOLLOWUP_24H,
} from "./followup-24h";

describe("follow-up 24h pronto", () => {
  it("o grafo publica no validador existente", () => {
    const r = validateFlowForPublish(grafoDeSilencio24h("11111111-1111-4111-8111-111111111111"));
    expect(r.ok).toBe(true);
  });

  it("reconhece o seed do Ready Model e o nome leigo", () => {
    expect(
      ehFollowupDeSilencio({
        name: "rm:locacao:silencio-24h",
        status: "draft",
        trigger_config: { kind: "silence", params: { threshold_minutes: MINUTOS_FOLLOWUP_24H } },
      }),
    ).toBe(true);
    expect(
      ehFollowupDeSilencio({
        name: "Lembrar cliente se não responder",
        trigger_config: { kind: "manual" },
      }),
    ).toBe(true);
  });
});
