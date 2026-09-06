import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { getAdapter } from "@/lib/channels";
import {
  CHANNEL_CAPABILITIES,
  CHANNEL_PROVIDER_TWILIO,
  capabilitiesOf,
} from "@/lib/channels/capabilities";
import { CHANNEL_SESSION_REF_COLUMNS, resolveSessionRef } from "@/lib/channels/session-ref";

const TWILIO = CHANNEL_PROVIDER_TWILIO;

describe("capabilities do canal hospedado", () => {
  it("é hetero-restrição: template fora da janela, sem ban de QR", () => {
    expect(capabilitiesOf(TWILIO)).toEqual({
      freeformOutsideWindow: false,
      requiresTemplates: true,
      canManageTemplates: false,
      banRisk: false,
      minIntervalMs: 6000,
      voiceNote: "opus-only",
      groups: "none",
      costPerMessage: true,
    });
    expect(CHANNEL_CAPABILITIES.waha.banRisk).toBe(true);
  });
});

describe("identificador da sessão", () => {
  it("resolve pelo número WhatsApp, não pelo SID da conta", () => {
    expect(
      resolveSessionRef({ provider: "twilio", twilio_from: "16472547342" }),
    ).toBe("16472547342");
    expect(CHANNEL_SESSION_REF_COLUMNS).toContain("twilio_from");
  });
});

describe("transporte", () => {
  it("getAdapter devolve este canal", () => {
    expect(getAdapter(TWILIO).provider).toBe(TWILIO);
    expect(getAdapter(TWILIO).sendTemplate).toBeTypeOf("function");
  });
});

describe("banco e TypeScript", () => {
  const baseline = readFileSync("supabase/baseline.sql", "utf8");

  it("o CHECK do baseline conhece o quarto canal", () => {
    expect(baseline).toMatch(/channel_sessions_provider_check[\s\S]{0,400}'twilio'/);
    expect(baseline).toMatch(/provider = 'twilio'\s+and twilio_from\s+is not null/);
  });

  it("migration + MANIFEST existem", () => {
    const mig = readFileSync(
      "supabase/migrations/20260904200000_0201_canal_twilio_vocabulario.sql",
      "utf8",
    );
    expect(mig).toContain("twilio_from");
    expect(readFileSync("supabase/migrations/MANIFEST.md", "utf8")).toContain(
      "0201_canal_twilio_vocabulario",
    );
  });
});
