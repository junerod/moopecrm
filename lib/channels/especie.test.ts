import { describe, expect, it } from "vitest";

import { especieDoProvider, rotuloDaEspecie } from "./especie";

describe("especie do canal", () => {
  it("todo transporte atual é WhatsApp na face da conversa", () => {
    expect(especieDoProvider("waha")).toBe("whatsapp");
    expect(especieDoProvider("meta_cloud")).toBe("whatsapp");
    expect(especieDoProvider("zernio")).toBe("whatsapp");
    expect(especieDoProvider("twilio")).toBe("whatsapp");
    expect(rotuloDaEspecie("whatsapp")).toBe("WhatsApp");
  });

  it("sem provider não inventa um canal", () => {
    expect(especieDoProvider(null)).toBeNull();
    expect(especieDoProvider("desconhecido")).toBeNull();
  });

  it("a face do transporte Instagram é o Instagram", () => {
    expect(especieDoProvider("instagram")).toBe("direct");
    expect(rotuloDaEspecie("direct")).toBe("Instagram");
  });
});
