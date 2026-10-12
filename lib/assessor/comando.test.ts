import { describe, expect, it } from "vitest";

import { fraseAlertaLead, mesmoTelefone } from "./comando";

describe("comando de alerta de lead", () => {
  it("reconhece ligar e desligar, e ignora o resto", () => {
    expect(fraseAlertaLead("Ligar alerta Lead")).toBe("on");
    expect(fraseAlertaLead("desligar alerta lead")).toBe("off");
    expect(fraseAlertaLead("ativar alerta leads")).toBe("on");
    expect(fraseAlertaLead("qual o alerta do lead de ontem")).toBeNull();
    expect(fraseAlertaLead("ligar alerta")).toBeNull();
  });

  it("trata o nono dígito como o mesmo celular", () => {
    expect(mesmoTelefone("+55 61 99999-0000", "61999990000")).toBe(true);
    expect(mesmoTelefone("5561999990000", "556199990000")).toBe(true);
    expect(mesmoTelefone("11988887777", "21988887777")).toBe(false);
  });
});
