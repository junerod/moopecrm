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

  it("Direct já tem rótulo — o selo existe antes do adapter", () => {
    expect(rotuloDaEspecie("direct")).toBe("Direct");
  });
});
