import { describe, expect, it } from "vitest";

import { casarItemDeFaq, casarOpcaoDoMenu, textoDoMenu } from "./menu-match";

const opcoes = [
  { id: "atendimento", numero: 1, label: "Atendimento", keywords: ["suporte"] },
  { id: "financeiro", numero: 2, label: "Financeiro", keywords: ["boleto"] },
];

describe("casarOpcaoDoMenu", () => {
  it("casa número isolado", () => {
    expect(casarOpcaoDoMenu("1", opcoes)).toBe("atendimento");
    expect(casarOpcaoDoMenu("2", opcoes)).toBe("financeiro");
  });

  it("artigo um não vira a opção 1", () => {
    const menu = [
      { id: "o1", numero: 1, label: "Sou locatário", keywords: ["locatario"] },
      { id: "o3", numero: 3, label: "Quero um carro", keywords: ["carro"] },
    ];
    expect(casarOpcaoDoMenu("quero um carro", menu)).toBe("o3");
    expect(casarOpcaoDoMenu("um", menu)).toBe("o1");
  });

  it("casa palavra-número", () => {
    expect(casarOpcaoDoMenu("um", opcoes)).toBe("atendimento");
    expect(casarOpcaoDoMenu("quero o dois", opcoes)).toBe("financeiro");
  });

  it("casa rótulo e palavra-chave", () => {
    expect(casarOpcaoDoMenu("financeiro", opcoes)).toBe("financeiro");
    expect(casarOpcaoDoMenu("boleto", opcoes)).toBe("financeiro");
  });

  it("sem match devolve null", () => {
    expect(casarOpcaoDoMenu("xyz", opcoes)).toBeNull();
  });
});

describe("casarItemDeFaq", () => {
  it("casa palavra-chave", () => {
    expect(casarItemDeFaq("qual o horario?", [{ id: "h", keywords: ["horario"] }])).toBe("h");
  });
});

describe("textoDoMenu", () => {
  it("numera as linhas", () => {
    const t = textoDoMenu("Como posso ajudar?", opcoes);
    expect(t).toContain("1 Atendimento");
    expect(t).toContain("2 Financeiro");
  });
});
