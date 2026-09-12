import { describe, expect, it } from "vitest";

import { ESPERA_APOS_QUEDA_MS, esperaAposQueda, fraseEsperaPareamento } from "./pareamento-cooldown";

const AGORA = new Date("2026-09-04T19:10:00Z");

describe("esperaAposQueda", () => {
  it("FAILED recente: espera o que falta para 6h", () => {
    const r = esperaAposQueda("FAILED", new Date("2026-09-04T16:10:00Z"), AGORA);
    expect(r.esperar).toBe(true);
    expect(r.waitSeconds).toBe(3 * 60 * 60);
    expect(r.until?.getTime()).toBe(new Date("2026-09-04T16:10:00Z").getTime() + ESPERA_APOS_QUEDA_MS);
  });

  it("FAILED há mais de 6h: libera o QR", () => {
    expect(esperaAposQueda("FAILED", new Date("2026-09-04T10:00:00Z"), AGORA).esperar).toBe(false);
  });

  it("sem carimbo ou STOPPED: não inventa espera", () => {
    expect(esperaAposQueda("FAILED", null, AGORA).esperar).toBe(false);
    expect(esperaAposQueda("STOPPED", AGORA, AGORA).esperar).toBe(false);
    expect(esperaAposQueda("WORKING", AGORA, AGORA).esperar).toBe(false);
  });

  it("SCAN_QR_CODE recente também espera — WORKING nunca", () => {
    expect(esperaAposQueda("SCAN_QR_CODE", new Date("2026-09-04T16:10:00Z"), AGORA).esperar).toBe(
      true,
    );
    expect(esperaAposQueda("WORKING", new Date("2026-09-04T16:10:00Z"), AGORA).esperar).toBe(false);
  });

  it("a frase mostra o horário, não o QR", () => {
    const until = new Date("2026-09-04T22:10:00Z");
    const frase = fraseEsperaPareamento(until, "UTC");
    expect(frase).toMatch(/O WhatsApp pediu espera depois da queda/);
    expect(frase).toMatch(/Escanear o QR agora piora/);
    expect(frase).toMatch(/22:10/);
  });
});
