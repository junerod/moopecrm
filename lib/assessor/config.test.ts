import { describe, expect, it } from "vitest";

import { blocoAssessor, deveAvisarAssessor, deveAvisarQueda, deveAvisarResposta, destinatariosDaQueda, destinatariosDaResposta, destinatariosDoAviso, ehFluxoComercialMoope, lerAssessorNasSettings, rotuloDaLinha } from "@/lib/assessor/config";

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

  it("avisa resposta só depois da primeira, quando a mensagem anterior foi nossa", () => {
    expect(
      deveAvisarResposta({
        replyEnabled: true,
        phone: "61999990000",
        inboundCount: 2,
        anteriorEraNosso: true,
      }),
    ).toBe(true);
    expect(
      deveAvisarResposta({
        replyEnabled: true,
        phone: "61999990000",
        inboundCount: 1,
        anteriorEraNosso: true,
      }),
    ).toBe(false);
    expect(
      deveAvisarResposta({
        replyEnabled: false,
        phone: "61999990000",
        inboundCount: 4,
        anteriorEraNosso: true,
      }),
    ).toBe(false);
    expect(
      deveAvisarResposta({
        replyEnabled: true,
        phone: "61999990000",
        inboundCount: 3,
        anteriorEraNosso: false,
      }),
    ).toBe(false);
  });

  it("lê o bloco assessor das settings da organização", () => {
    expect(lerAssessorNasSettings({ assessor: { enabled: true, phone: "+5561999990000" } })).toEqual({
      enabled: true,
      replyEnabled: false,
      phone: "+5561999990000",
      contacts: [
        {
          id: "legado-61999990000",
          name: "",
          phone: "+5561999990000",
          leadEnabled: true,
          replyEnabled: false,
        },
      ],
    });
    expect(lerAssessorNasSettings({ assessor: { reply_enabled: true, phone: "61999990000" } })).toEqual({
      enabled: false,
      replyEnabled: true,
      phone: "61999990000",
      contacts: [
        {
          id: "legado-61999990000",
          name: "",
          phone: "61999990000",
          leadEnabled: false,
          replyEnabled: true,
        },
      ],
    });
    expect(lerAssessorNasSettings(null)).toEqual({
      enabled: false,
      replyEnabled: false,
      phone: "",
      contacts: [],
    });
  });

  it("guarda várias pessoas e avisa só quem ligou o alerta", () => {
    const bloco = blocoAssessor([
      { id: "a", name: "Ana", phone: "61911112222", leadEnabled: true, replyEnabled: false },
      { id: "b", name: "Bruno", phone: "11988887777", leadEnabled: false, replyEnabled: true },
    ]);
    const lido = lerAssessorNasSettings({ assessor: bloco });
    expect(lido.contacts.map((c) => c.name)).toEqual(["Ana", "Bruno"]);
    expect(lido.phone).toBe("61911112222");
    expect(lido.enabled).toBe(true);
    expect(lido.replyEnabled).toBe(true);
    expect(
      destinatariosDoAviso({
        fluxoComercial: false,
        phones: lido.contacts.filter((c) => c.leadEnabled).map((c) => c.phone),
      }),
    ).toEqual(["61911112222"]);
    expect(destinatariosDaResposta(lido.contacts)).toEqual(["11988887777"]);
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

  it("queda avisa a lista inteira, e oscilação de rede não vira Zap", () => {
    const bloco = blocoAssessor([
      { id: "a", name: "Ana", phone: "61911112222", leadEnabled: false, replyEnabled: false },
      { id: "b", name: "Bruno", phone: "11988887777", leadEnabled: true, replyEnabled: true },
    ]);
    const lido = lerAssessorNasSettings({ assessor: bloco });
    expect(destinatariosDaQueda(lido.contacts)).toEqual(["61911112222", "11988887777"]);
    expect(deveAvisarQueda("FAILED")).toBe(true);
    expect(deveAvisarQueda("SCAN_QR_CODE")).toBe(true);
    expect(deveAvisarQueda("CREDENCIAL_RECUSADA")).toBe(true);
    expect(deveAvisarQueda("UNREACHABLE")).toBe(false);
    expect(deveAvisarQueda("")).toBe(false);
  });
});
