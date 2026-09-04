import { describe, expect, it } from "vitest";

import { PACING_DEFAULTS } from "@/lib/agent-engine/pacing/defaults";
import { WARMUP_PULADO, type ChannelKnobsRow } from "@/lib/ai/pacing-knobs";

import { montarRetratoDoCanal } from "./canal-do-parceiro";

const COMERCIAL = new Date("2026-09-05T13:00:00Z"); // 10h BRT
const VAZIO: ChannelKnobsRow = {
  throttle_ms: null,
  jitter_max_ms: null,
  window_start_hour: null,
  window_end_hour: null,
  allow_sunday: null,
  timezone: null,
  warmup_daily_caps: null,
};

describe("montarRetratoDoCanal", () => {
  it("sem número pareado: locadora não dispara", () => {
    const r = montarRetratoDoCanal({
      status: null,
      knobs: PACING_DEFAULTS,
      knobsRow: null,
      sentToday: 0,
      numberActivatedAt: null,
      lastSentAt: null,
      dailyLimit: 250,
      banRisk: true,
      agora: COMERCIAL,
    });
    expect(r.phase).toBe("no_channel");
    expect(r.ready).toBe(false);
    expect(r.can_send_now).toBe(false);
    expect(r.connected).toBe(false);
    expect(r.needs_qr).toBe(false);
    expect(r.can_soft_reconnect).toBe(false);
    expect(r.warmup.remaining_today).toBe(0);
  });

  it("já aquecido: phase ready, remaining é o teto menos o que saiu", () => {
    const r = montarRetratoDoCanal({
      status: "WORKING",
      knobs: { ...PACING_DEFAULTS, warmupDailyCaps: [...WARMUP_PULADO] },
      knobsRow: { ...VAZIO, warmup_daily_caps: [...WARMUP_PULADO] },
      sentToday: 12,
      numberActivatedAt: new Date("2020-01-01"),
      lastSentAt: new Date(COMERCIAL.getTime() - 8_000),
      dailyLimit: 500,
      banRisk: true,
      agora: COMERCIAL,
    });
    expect(r.phase).toBe("ready");
    expect(r.ready).toBe(true);
    expect(r.can_send_now).toBe(true);
    expect(r.connected).toBe(true);
    expect(r.warmup.skipped).toBe(true);
    expect(r.warmup.cap_today).toBeNull();
    expect(r.warmup.remaining_today).toBe(488);
    expect(r.proactive_gap_seconds).toBe(5);
  });

  it("chip novo no teto de 20: aquecendo, não manda mais hoje", () => {
    const r = montarRetratoDoCanal({
      status: "WORKING",
      knobs: PACING_DEFAULTS,
      knobsRow: VAZIO,
      sentToday: 20,
      numberActivatedAt: null,
      lastSentAt: new Date(COMERCIAL.getTime() - 8_000),
      dailyLimit: 500,
      banRisk: true,
      agora: COMERCIAL,
    });
    expect(r.phase).toBe("warming");
    expect(r.ready).toBe(false);
    expect(r.can_send_now).toBe(false);
    expect(r.warmup.cap_today).toBe(20);
    expect(r.warmup.remaining_today).toBe(0);
  });

  it("à noite a janela fecha mesmo com número pronto", () => {
    const r = montarRetratoDoCanal({
      status: "WORKING",
      knobs: PACING_DEFAULTS,
      knobsRow: { ...VAZIO, warmup_daily_caps: [...WARMUP_PULADO] },
      sentToday: 0,
      numberActivatedAt: new Date("2020-01-01"),
      lastSentAt: null,
      dailyLimit: 500,
      banRisk: true,
      agora: new Date("2026-09-05T04:00:00Z"),
    });
    expect(r.window.open).toBe(false);
    expect(r.can_send_now).toBe(false);
    expect(r.retry_after).toBeGreaterThan(60);
  });
});
