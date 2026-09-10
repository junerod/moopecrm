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
});
