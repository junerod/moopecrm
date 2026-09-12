import { describe, expect, it } from "vitest";

import { ehPeriodoPronto, janelaDoPeriodo } from "@/lib/supervisao/periodo";

describe("período da supervisão", () => {
  const agora = new Date("2026-09-12T15:00:00.000Z");

  it("hoje começa à meia-noite local", () => {
    const { from, to } = janelaDoPeriodo("hoje", agora);
    expect(to.toISOString()).toBe(agora.toISOString());
    expect(from.getHours()).toBe(0);
  });

  it("7 e 30 dias recuam sem inventar calendário custom", () => {
    expect(janelaDoPeriodo("7d", agora).from.getTime()).toBe(agora.getTime() - 7 * 86400000);
    expect(janelaDoPeriodo("30d", agora).from.getTime()).toBe(agora.getTime() - 30 * 86400000);
  });

  it("só aceita os três períodos prontos", () => {
    expect(ehPeriodoPronto("7d")).toBe(true);
    expect(ehPeriodoPronto("custom")).toBe(false);
  });
});
