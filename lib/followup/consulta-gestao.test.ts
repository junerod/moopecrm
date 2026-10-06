import { describe, expect, it } from "vitest";

import {
  textoDaOferta,
  textoDaSituacao,
  textoDoBoleto,
  textoDoCliente,
  textoDoFinanceiro,
  textoDoInvestidor,
} from "./consulta-gestao";
import type { OfertaItem, RetratoLocatario } from "@/lib/moope/cliente-locadora";

function oferta(parcial: Partial<OfertaItem> = {}): OfertaItem {
  return {
    modelo: "Onix",
    marca: null,
    ano: null,
    placa: "ABC1D23",
    valor_diario: null,
    valor_semanal: null,
    valor_mensal: null,
    status: "DISPONIVEL",
    propulsao: null,
    eletrico: false,
    opcionais: null,
    foto_url: null,
    ...parcial,
  };
}

function retrato(parcial: Partial<RetratoLocatario> = {}): RetratoLocatario {
  return {
    locatario_id: "loc_1",
    nome: "Ana",
    telefone: "+5511999999999",
    email: "ana@exemplo.com",
    placa: null,
    veiculo_modelo: null,
    contrato_titulo: null,
    contrato_status: null,
    faixa: "interna",
    amount_cents: null,
    days_late: null,
    portal_url: null,
    boleto_url: null,
    invoice_url: null,
    documentos: [],
    pode: [],
    ...parcial,
  };
}

describe("texto da consulta à gestão", () => {
  it("não inventa preço quando a oferta não trouxe valor", () => {
    const r = textoDaOferta([oferta()]);
    expect(r.achou).toBe(true);
    expect(r.texto).toContain("Onix");
    expect(r.texto).toContain("disponível");
    expect(r.texto).not.toMatch(/R\$/);
    expect(r.texto).not.toContain("ABC1D23");
  });

  it("escreve o valor que veio e marca alugado", () => {
    const r = textoDaOferta([oferta({ valor_diario: 120, status: "ALUGADO" })]);
    expect(r.texto).toContain("R$ 120,00/dia");
    expect(r.texto).toContain("alugado");
  });

  it("lista vazia não vira mensagem", () => {
    expect(textoDaOferta([])).toEqual({ achou: false, texto: "" });
  });

  it("cliente sai com nome e status, sem dado que não veio", () => {
    const r = textoDoCliente("Ana", "ativo");
    expect(r.texto).toBe("Encontrei o cadastro de Ana.\nContrato: ativo.");
    expect(textoDoCliente("  ", null).achou).toBe(false);
  });

  it("situação não leva e-mail nem link que não é https", () => {
    const r = textoDaSituacao(
      retrato({
        placa: "ABC1D23",
        veiculo_modelo: "Onix",
        days_late: 3,
        boleto_url: "http://boleto.inseguro",
        portal_url: "https://portal.exemplo/ana",
      }),
    );
    expect(r.texto).toContain("Onix · ABC1D23");
    expect(r.texto).toContain("Atraso de 3 dias.");
    expect(r.texto).toContain("https://portal.exemplo/ana");
    expect(r.texto).not.toContain("ana@exemplo.com");
    expect(r.texto).not.toContain("boleto.inseguro");
    expect(r.texto).not.toContain("interna");
  });

  it("financeiro sem parcela e sem link oficial não finge cobrança", () => {
    expect(
      textoDoFinanceiro({
        parcelas: [],
        boleto_url: "nota-interna",
        pix_url: null,
        portal_url: null,
      }),
    ).toEqual({ achou: false, texto: "" });
  });

  it("financeiro escreve vencimento, valor e o boleto https", () => {
    const r = textoDoFinanceiro({
      parcelas: [
        {
          parcela_id: "p1",
          vencimento: "2026-10-10",
          valor: 890.5,
          status: "aberta",
          atraso_dias: 0,
        },
      ],
      boleto_url: "https://boleto.exemplo/1",
      pix_url: null,
      portal_url: null,
    });
    expect(r.achou).toBe(true);
    expect(r.texto).toContain("2026-10-10");
    expect(r.texto).toContain("R$ 890,50");
    expect(r.texto).toContain("https://boleto.exemplo/1");
    expect(r.texto).not.toContain("atraso");
  });

  it("boleto só sai com link https", () => {
    expect(
      textoDoBoleto({
        boleto_url: "http://inseguro",
        pix_url: null,
        portal_url: "https://portal.exemplo/p",
      }).texto,
    ).toContain("https://portal.exemplo/p");
    expect(
      textoDoBoleto({ boleto_url: "https://boleto.exemplo/2", pix_url: null, portal_url: null }).texto,
    ).toContain("Segunda via do boleto");
    expect(textoDoBoleto({ boleto_url: null, pix_url: null, portal_url: null })).toEqual({
      achou: false,
      texto: "",
    });
  });

  it("investidor usa nome e portal https, e cala sem nome", () => {
    const r = textoDoInvestidor("Carlos", "set/2026", "http://nao");
    expect(r.texto).toContain("Carlos");
    expect(r.texto).toContain("set/2026");
    expect(r.texto).not.toContain("http://nao");
    expect(textoDoInvestidor("  ", null, null)).toEqual({ achou: false, texto: "" });
  });
});
