import { describe, expect, it } from "vitest";

import { origemAoNascer } from "./nascimento-do-lead";

describe("origemAoNascer", () => {
  it("Direct vira Instagram, não WhatsApp", () => {
    expect(origemAoNascer("instagram", false)).toBe("instagram");
    expect(origemAoNascer("direct", false)).toBe("instagram");
  });

  it("anúncio mantém a plataforma do first-touch", () => {
    expect(origemAoNascer("meta_ads", true)).toBe("meta_ads");
  });

  it("sem sinal de Instagram continua WhatsApp", () => {
    expect(origemAoNascer(null, false)).toBe("whatsapp");
  });
});
