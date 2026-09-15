import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { getAdapter } from "@/lib/channels";
import {
  CHANNEL_PROVIDER_INSTAGRAM,
  capabilitiesOf,
} from "@/lib/channels/capabilities";
import { campanhaComercialPermitidaPelasCaps } from "@/lib/channels/campaign-send";
import { CHANNEL_SESSION_REF_COLUMNS, resolveSessionRef } from "@/lib/channels/session-ref";

const DIRECT = CHANNEL_PROVIDER_INSTAGRAM;

describe("capabilities do Direct", () => {
  it("texto livre na janela, sem template e sem disparo frio", () => {
    expect(capabilitiesOf(DIRECT)).toEqual({
      freeformOutsideWindow: false,
      requiresTemplates: false,
      canManageTemplates: false,
      banRisk: false,
      minIntervalMs: null,
      voiceNote: "opus-only",
      groups: "none",
      costPerMessage: false,
    });
    expect(campanhaComercialPermitidaPelasCaps(DIRECT)).toBe(false);
  });
});

describe("identificador da sessão", () => {
  it("resolve pelo id da conta, não por telefone", () => {
    expect(
      resolveSessionRef({ provider: "instagram", instagram_account_id: "17841400000" }),
    ).toBe("17841400000");
    expect(CHANNEL_SESSION_REF_COLUMNS).toContain("instagram_account_id");
  });
});

describe("transporte", () => {
  it("getAdapter devolve este canal", () => {
    expect(getAdapter(DIRECT).provider).toBe(DIRECT);
    const destinatario = {
      isGroup: false,
      groupChatId: null,
      phoneNumber: null,
    };
    expect(
      getAdapter(DIRECT).resolveRecipient({ ...destinatario, waIdentity: "igsid:ana" }),
    ).toBe("ana");
    expect(
      getAdapter(DIRECT).resolveRecipient({
        ...destinatario,
        waIdentity: "+5511999999999",
      }),
    ).toBeNull();
  });
});

describe("banco e TypeScript", () => {
  const baseline = readFileSync("supabase/baseline.sql", "utf8");

  it("o CHECK do baseline conhece o quinto canal", () => {
    expect(baseline).toMatch(/channel_sessions_provider_check[\s\S]{0,500}'instagram'/);
    expect(baseline).toMatch(
      /provider = 'instagram'\s+and instagram_account_id\s+is not null/,
    );
  });

  it("migration + MANIFEST existem", () => {
    const mig = readFileSync(
      "supabase/migrations/20260915120000_0210_canal_instagram_vocabulario.sql",
      "utf8",
    );
    expect(mig).toContain("instagram_account_id");
    expect(readFileSync("supabase/migrations/MANIFEST.md", "utf8")).toContain(
      "0210_canal_instagram_vocabulario",
    );
  });
});
