import { describe, expect, it } from "vitest";

import { ehE164, normalizarE164 } from "./telefone-e164";

describe("normalizarE164", () => {
  it("aceita E.164 e mascara comum BR", () => {
    expect(normalizarE164("+5511999887766")).toBe("+5511999887766");
    expect(normalizarE164("55 11 99988-7766")).toBe("+5511999887766");
  });
  it("recusa curto, sem DDI, ou lixo", () => {
    expect(normalizarE164("999887766")).toBeNull();
    expect(normalizarE164("+0123")).toBeNull();
    expect(normalizarE164("")).toBeNull();
    expect(ehE164(null)).toBe(false);
  });
});
