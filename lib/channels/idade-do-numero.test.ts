import { describe, expect, it } from "vitest";

import { WARMUP_PULADO } from "@/lib/ai/pacing-knobs";
import { warmupCapFor } from "@/lib/agent-engine/pacing/engine";
import { PACING_DEFAULTS } from "@/lib/agent-engine/pacing/defaults";

import {
  declaracaoDoNumeroSchema,
  efeitoDaDeclaracao,
  TETO_DIARIO_NUMERO_JA_EM_USO,
  TETO_DIARIO_NUMERO_NOVO,
} from "./idade-do-numero";

describe("efeitoDaDeclaracao", () => {
  it("número já em uso: sem teto de aquecimento, teto do dia cabe 300 locatários", () => {
    const e = efeitoDaDeclaracao({ numero_ja_em_uso: true });
    expect(e.warmup_daily_caps).toEqual([...WARMUP_PULADO]);
    expect(e.daily_message_limit).toBe(TETO_DIARIO_NUMERO_JA_EM_USO);
    expect(e.daily_message_limit).toBeGreaterThanOrEqual(300);
    expect(warmupCapFor(0, [...(e.warmup_daily_caps ?? [])])).toBeNull();
  });

  it("número novo: aquecimento no degrau conservador, teto 250", () => {
    const e = efeitoDaDeclaracao({ numero_ja_em_uso: false });
    expect(e.warmup_daily_caps).toBeNull();
    expect(e.daily_message_limit).toBe(TETO_DIARIO_NUMERO_NOVO);
    expect(warmupCapFor(0, PACING_DEFAULTS.warmupDailyCaps)).toBe(20);
  });
});

describe("declaracaoDoNumeroSchema", () => {
  it("exige a resposta — omitir não é 'já em uso'", () => {
    expect(declaracaoDoNumeroSchema.safeParse({}).success).toBe(false);
    expect(declaracaoDoNumeroSchema.safeParse({ numero_ja_em_uso: true }).success).toBe(true);
    expect(declaracaoDoNumeroSchema.safeParse({ numero_ja_em_uso: false }).success).toBe(true);
  });
});
