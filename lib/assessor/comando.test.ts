import { describe, expect, it } from "vitest";

import { fraseAlertaLead, fraseConsultaCrm, mesmoTelefone } from "./comando";

describe("comando de alerta de lead", () => {
  it("reconhece ligar e desligar, e ignora o resto", () => {
    expect(fraseAlertaLead("Ligar alerta Lead")).toEqual({ kind: "lead", lado: "on" });
    expect(fraseAlertaLead("desligar alerta lead")).toEqual({ kind: "lead", lado: "off" });
    expect(fraseAlertaLead("ativar alerta leads")).toEqual({ kind: "lead", lado: "on" });
    expect(fraseAlertaLead("ligar alerta resposta")).toEqual({ kind: "resposta", lado: "on" });
    expect(fraseAlertaLead("desligar alerta resposta")).toEqual({ kind: "resposta", lado: "off" });
    expect(fraseAlertaLead("qual o alerta do lead de ontem")).toBeNull();
    expect(fraseAlertaLead("ligar alerta")).toBeNull();
    expect(fraseConsultaCrm("leads do dia")).toBe("dia");
    expect(fraseConsultaCrm("leads da semana")).toBe("semana");
    expect(fraseConsultaCrm("leads abertos")).toBe("abertos");
    expect(fraseConsultaCrm("quem respondeu hoje")).toBe("respostas");
    expect(fraseConsultaCrm("ligar alerta lead")).toBeNull();
  });

  it("trata o nono dígito como o mesmo celular", () => {
    expect(mesmoTelefone("+55 61 99999-0000", "61999990000")).toBe(true);
    expect(mesmoTelefone("5561999990000", "556199990000")).toBe(true);
    expect(mesmoTelefone("11988887777", "21988887777")).toBe(false);
  });
});
