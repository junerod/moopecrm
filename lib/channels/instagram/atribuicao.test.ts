import { describe, expect, it } from "vitest";

import { extrairAtribuicaoDirect } from "./atribuicao";

describe("extrairAtribuicaoDirect", () => {
  it("anúncio vira origem no primeiro toque", () => {
    const a = extrairAtribuicaoDirect({
      source: "ADS",
      type: "OPEN_THREAD",
      ads_context_data: { ad_title: "Reel do SUV", post_id: "post-9" },
    });
    expect(a).toEqual(
      expect.objectContaining({
        plataforma: "meta_ads",
        sourceId: "post-9",
        titulo: "Reel do SUV",
      }),
    );
  });

  it("chat orgânico não inventa origem", () => {
    expect(extrairAtribuicaoDirect({ source: "CUSTOMER_CHAT_PLUGIN" })).toBeNull();
    expect(extrairAtribuicaoDirect(null)).toBeNull();
  });
});
