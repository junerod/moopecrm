import { describe, expect, it } from "vitest";

import {
  CLASSIFICACAO_ALERTA_INTERNO,
  chaveDeIdempotencia,
  elegivelParaAlerta,
  montarMensagemAlerta,
} from "./alerta-interno";

const ACAO = {
  demandaId: "d1",
  organizationId: "o1",
  texto: "Retornar proposta",
  em: "2026-09-12T15:00:00.000-03:00",
  donoUserId: "u1",
  contactName: "Carlos Pereira",
  clientPhone: "+5511988880000",
};

const PREFS = { enabled: true, phone: "+5511999887766", antecedenciaMin: 30 as const };

describe("elegivelParaAlerta", () => {
  it("pre_due 10 min antes com opt-in e telefone do atendente", () => {
    const r = elegivelParaAlerta({
      acao: ACAO,
      prefs: PREFS,
      kind: "pre_due",
      agora: new Date("2026-09-12T14:35:00.000-03:00"),
      jaEnviado: false,
    });
    expect(r).toEqual({ ok: true, dest: "+5511999887766" });
  });
  it("não envia sem opt-in, sem telefone, já enviado, ou telefone do cliente", () => {
    expect(
      elegivelParaAlerta({
        acao: ACAO,
        prefs: { ...PREFS, enabled: false },
        kind: "pre_due",
        agora: new Date("2026-09-12T14:35:00.000-03:00"),
        jaEnviado: false,
      }).ok,
    ).toBe(false);
    expect(
      elegivelParaAlerta({
        acao: ACAO,
        prefs: { ...PREFS, phone: null },
        kind: "overdue",
        agora: new Date("2026-09-12T16:00:00.000-03:00"),
        jaEnviado: false,
      }).ok,
    ).toBe(false);
    expect(
      elegivelParaAlerta({
        acao: ACAO,
        prefs: PREFS,
        kind: "pre_due",
        agora: new Date("2026-09-12T14:35:00.000-03:00"),
        jaEnviado: true,
      }).ok,
    ).toBe(false);
    expect(
      elegivelParaAlerta({
        acao: ACAO,
        prefs: { ...PREFS, phone: "+5511988880000" },
        kind: "pre_due",
        agora: new Date("2026-09-12T14:35:00.000-03:00"),
        jaEnviado: false,
      }),
    ).toEqual({ ok: false, motivo: "telefone_e_do_cliente" });
  });
  it("reagendar muda a chave — o slot antigo não colide com o novo", () => {
    const a = chaveDeIdempotencia({ demandaId: "d1", kind: "pre_due", dueAt: "2026-09-12T15:00:00.000Z" });
    const b = chaveDeIdempotencia({ demandaId: "d1", kind: "pre_due", dueAt: "2026-09-12T17:00:00.000Z" });
    expect(a).not.toBe(b);
  });
});

describe("montarMensagemAlerta", () => {
  it("é curta e não leva telefone do cliente", () => {
    const pre = montarMensagemAlerta({
      kind: "pre_due",
      contactName: "Carlos Pereira",
      texto: "Retornar proposta",
      em: "2026-09-12T15:00:00.000-03:00",
    });
    expect(pre).toContain("MOOPE CRM");
    expect(pre).toContain("Carlos Pereira");
    expect(pre).not.toContain("88880000");
    expect(CLASSIFICACAO_ALERTA_INTERNO).toBe("alerta_interno_atendente");
  });
});
