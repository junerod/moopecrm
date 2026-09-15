import { describe, expect, it } from "vitest";

import { validateFlowForPublish } from "@/lib/followup/validate-publish";

import {
  ajusteFollowup24hSchema,
  ehFollowupDeSilencio,
  grafoDeSilencio24h,
  horasDoFollowup,
  MINUTOS_FOLLOWUP_24H,
  resolverAjusteFollowup24h,
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

  it("a tela manda a mensagem e as horas — a semente não trava o texto", () => {
    const atual = {
      mensagem: "Olá, conseguiu analisar nossa proposta?",
      minutos: MINUTOS_FOLLOWUP_24H,
    };
    expect(
      resolverAjusteFollowup24h({ mensagem: "Ainda precisa de ajuda com o laudo?", horas: 48 }, atual),
    ).toEqual({ mensagem: "Ainda precisa de ajuda com o laudo?", minutos: 2880 });
    expect(resolverAjusteFollowup24h({}, atual)).toEqual(atual);
    expect(ajusteFollowup24hSchema.safeParse({ mensagem: "", horas: 24 }).success).toBe(false);
    expect(ajusteFollowup24hSchema.safeParse({ horas: 200 }).success).toBe(false);
    expect(horasDoFollowup({ kind: "silence", params: { threshold_minutes: 2880 } })).toBe(48);
  });
});
