import { describe, expect, it } from "vitest";

import { deveAvisarAssessor, destinatariosDoAviso, ehFluxoComercialMoope, lerAssessorNasSettings, rotuloDaLinha } from "@/lib/assessor/config";

describe("Meu Assessor · aviso de cliente novo", () => {
  it("avisa só na primeira mensagem, com número ligado", () => {
    expect(
      deveAvisarAssessor({ enabled: true, phone: "61999990000", inboundCount: 1 }),
    ).toBe(true);
    expect(
      deveAvisarAssessor({ enabled: true, phone: "61999990000", inboundCount: 2 }),
    ).toBe(false);
    expect(
      deveAvisarAssessor({ enabled: false, phone: "61999990000", inboundCount: 1 }),
    ).toBe(false);
    expect(deveAvisarAssessor({ enabled: true, phone: "", inboundCount: 1 })).toBe(false);
  });

  it("lê o bloco assessor das settings da organização", () => {
    expect(lerAssessorNasSettings({ assessor: { enabled: true, phone: "+5561999990000" } })).toEqual({
      enabled: true,
      phone: "+5561999990000",
    });
    expect(lerAssessorNasSettings(null)).toEqual({ enabled: false, phone: "" });
  });

  it("no comercial da MOOPE avisa Tatiana e o DEV, e distingue a linha", () => {
    expect(ehFluxoComercialMoope(["Comercial@moope.com.br"])).toBe(true);
    expect(ehFluxoComercialMoope(["outro@cliente.com"])).toBe(false);
    expect(
      destinatariosDoAviso({
        fluxoComercial: true,
        phoneConfigurado: "",
        enabled: false,
      }).map((p) => p.replace(/\D/g, "")),
    ).toEqual(["5531984246434", "5561996715985"]);
    expect(
      destinatariosDoAviso({
        fluxoComercial: false,
        phoneConfigurado: "11988887777",
        enabled: true,
      }),
    ).toEqual(["11988887777"]);
    expect(
      destinatariosDoAviso({
        fluxoComercial: false,
        phoneConfigurado: "",
        enabled: false,
      }),
    ).toEqual([]);
    expect(rotuloDaLinha("+55 61 99411-4879")?.rotulo).toBe("SUPORTE");
    expect(rotuloDaLinha("5561992089343")?.rotulo).toBe("COMERCIAL");
    expect(rotuloDaLinha("+55 11 99999-0000")).toBeNull();
  });
});
