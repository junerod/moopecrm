import { describe, expect, it } from "vitest";

import { PACING_DEFAULTS, PROACTIVE_THROTTLE_MS } from "@/lib/agent-engine/pacing/defaults";
import { decidirDisparo, knobsDoDisparoProativo } from "@/lib/moope/pacing-do-disparo";

const COMERCIAL = new Date("2026-09-05T13:00:00Z"); // 10h BRT

describe("knobsDoDisparoProativo", () => {
  it("sobe o throttle de conversa para o piso de boleto", () => {
    expect(knobsDoDisparoProativo(PACING_DEFAULTS).throttleMs).toBe(PROACTIVE_THROTTLE_MS);
  });

  it("respeita canal já mais lento que o piso", () => {
    expect(
      knobsDoDisparoProativo({ ...PACING_DEFAULTS, throttleMs: 8000 }).throttleMs,
    ).toBe(8000);
  });
});

describe("decidirDisparo", () => {
  it("à noite adia para a janela", () => {
    const r = decidirDisparo({
      now: new Date("2026-09-05T04:00:00Z"), // 1h BRT
      knobs: PACING_DEFAULTS,
      state: { lastSentAt: null, sentToday: 0, numberActivatedAt: new Date("2020-01-01") },
      crmDailyLimit: 300,
      banRisk: true,
      rng: () => 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retry_after).toBeGreaterThan(60);
  });

  it("100º boleto no mesmo segundo pede espera, não rajada", () => {
    const r = decidirDisparo({
      now: COMERCIAL,
      knobs: PACING_DEFAULTS,
      state: {
        lastSentAt: new Date(COMERCIAL.getTime() - 400),
        sentToday: 12,
        numberActivatedAt: new Date("2020-01-01"),
      },
      crmDailyLimit: 300,
      banRisk: true,
      rng: () => 0,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retry_after).toBeGreaterThanOrEqual(4);
  });

  it("número frio com 20 envios no dia para", () => {
    const r = decidirDisparo({
      now: COMERCIAL,
      knobs: PACING_DEFAULTS,
      state: { lastSentAt: null, sentToday: 20, numberActivatedAt: null },
      crmDailyLimit: 300,
      banRisk: true,
      rng: () => 0,
    });
    expect(r.ok).toBe(false);
  });

  it("número maduro, intervalo cumprido, deixa passar", () => {
    const r = decidirDisparo({
      now: COMERCIAL,
      knobs: PACING_DEFAULTS,
      state: {
        lastSentAt: new Date(COMERCIAL.getTime() - 8_000),
        sentToday: 3,
        numberActivatedAt: new Date("2020-01-01"),
      },
      crmDailyLimit: 300,
      banRisk: true,
      rng: () => 0,
    });
    expect(r).toEqual({ ok: true });
  });
});
