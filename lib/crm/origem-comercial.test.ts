import { describe, expect, it } from "vitest";

import { rotuloDaOrigem } from "./origem-comercial";

describe("rotuloDaOrigem", () => {
  it("traduz as origens do comercial", () => {
    expect(rotuloDaOrigem("instagram")).toBe("Instagram");
    expect(rotuloDaOrigem("indicacao")).toBe("Indicação");
    expect(rotuloDaOrigem("prospeccao")).toBe("Prospecção");
  });

  it("não inventa rótulo para fonte desconhecida", () => {
    expect(rotuloDaOrigem("ads_meta")).toBe("ads_meta");
    expect(rotuloDaOrigem(null)).toBe("—");
  });

  it("Direct entra como Instagram, não como jargão de transporte", () => {
    expect(rotuloDaOrigem("direct")).toBe("Instagram");
  });

  it("traduz o first-touch de anúncio que o contato já grava", () => {
    expect(rotuloDaOrigem("meta_ads")).toBe("Anúncio (Meta)");
    expect(rotuloDaOrigem("Meta_ads")).toBe("Anúncio (Meta)");
    expect(rotuloDaOrigem("google_ads")).toBe("Anúncio (Google)");
  });
});
