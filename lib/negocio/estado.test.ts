import { describe, expect, it } from "vitest";

import { montarEstadoDoSetup } from "./estado";

const BASE = {
  empresa: "Máquinas Norte",
  settings: {
    perfil_do_negocio: {
      id: "locacao",
      version: "1.0",
      subtype: "maquinas_e_equipamentos",
      aplicado_em: "2026-01-01T00:00:00.000Z",
    },
    ai_mode: "off",
  },
  sessoes: [] as Array<{ id: string; status: string | null; phone_number: string | null }>,
  fontes: 0,
  assistentes: 0,
  assistentesPublicados: 0,
  automacoesAtivas: 0,
  pipeline: "Atendimento",
  equipe: 1,
};

describe("montarEstadoDoSetup", () => {
  it("mostra Locação + Máquinas e equipamentos", () => {
    const e = montarEstadoDoSetup(BASE);
    expect(e.modeloRotulo).toBe("Locação");
    expect(e.subtipo).toBe("Máquinas e equipamentos");
    expect(e.checklist.find((i) => i.id === "empresa")?.feito).toBe(true);
  });

  it("WORKING com telefone prevalece sobre residual sem número", () => {
    const e = montarEstadoDoSetup({
      ...BASE,
      sessoes: [
        { id: "resid", status: "FAILED", phone_number: null },
        { id: "ok", status: "WORKING", phone_number: "5511999999343" },
      ],
    });
    expect(e.whatsappConectado).toBe(true);
    expect(e.whatsappNumero).toBe("…9343");
    expect(e.cards.find((c) => c.id === "whatsapp")?.estado).toBe("ok");
    expect(e.cards.find((c) => c.id === "whatsapp")?.resumo).toMatch(/Conectado/);
  });

  it("vários WORKING: usa o que tem telefone", () => {
    const e = montarEstadoDoSetup({
      ...BASE,
      sessoes: [
        { id: "a", status: "WORKING", phone_number: null },
        { id: "b", status: "WORKING", phone_number: "11988887777" },
      ],
    });
    expect(e.whatsappConectado).toBe(true);
    expect(e.whatsappNumero).toBe("…7777");
  });

  it("só residual FAILED sem WORKING = não conectado", () => {
    const e = montarEstadoDoSetup({
      ...BASE,
      sessoes: [{ id: "resid", status: "FAILED", phone_number: null }],
    });
    expect(e.whatsappConectado).toBe(false);
    expect(e.cards.find((c) => c.id === "whatsapp")?.estado).toBe("atencao");
  });

  it("checklist reflete conhecimento, automação e IA", () => {
    const e = montarEstadoDoSetup({
      ...BASE,
      settings: { ...BASE.settings, ai_mode: "copilot" },
      fontes: 2,
      automacoesAtivas: 1,
      equipe: 2,
    });
    expect(e.checklist.find((i) => i.id === "conhecimento")?.feito).toBe(true);
    expect(e.checklist.find((i) => i.id === "automacao")?.feito).toBe(true);
    expect(e.checklist.find((i) => i.id === "ia")?.feito).toBe(true);
    expect(e.checklist.find((i) => i.id === "equipe")?.feito).toBe(true);
    expect(e.aiModeRotulo).toBe("Assistente");
  });
});
