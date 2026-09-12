import { describe, expect, it } from "vitest";

import {
  AUDITORIA_MOOPE_GESTAO,
  NAO_CONSEGUI_CONSULTAR,
  fatosParaCopiloto,
  locatarioIdDoContato,
  mensagemDaFalha,
  projetarRetratoComercial,
  retratoDoCache,
} from "@/lib/moope/retrato-comercial";

describe("retrato comercial MOOPE", () => {
  it("lê locatário só do metadata — tenant do contato, não inventa", () => {
    expect(locatarioIdDoContato({ source: "moope", source_metadata: {} })).toBeNull();
    expect(
      locatarioIdDoContato({
        source: "moope",
        source_metadata: { moope_external_id: "loc-1" },
      }),
    ).toBe("loc-1");
  });

  it("projeta só campos existentes", () => {
    const p = projetarRetratoComercial({
      locatario_id: "loc-1",
      nome: "Ana",
      telefone: null,
      email: null,
      placa: "ABC1D23",
      veiculo_modelo: "Onix",
      contrato_titulo: "Contrato 12",
      contrato_status: "ativo",
      faixa: "em_dia",
      amount_cents: 0,
      days_late: 0,
      portal_url: "https://gestao.example/cliente/1",
      boleto_url: null,
      invoice_url: null,
      documentos: [],
      pode: [],
    });
    expect(p.em_dia).toBe(true);
    expect(p.placa).toBe("ABC1D23");
    expect(fatosParaCopiloto(p)).toContain("Ana");
    expect(fatosParaCopiloto(p)).toContain("Onix");
  });

  it("falha fecha sem inventar", () => {
    expect(mensagemDaFalha({ ok: false, codigo: "indisponivel" })).toBe(NAO_CONSEGUI_CONSULTAR);
    expect(mensagemDaFalha({ ok: false, codigo: "sem_integracao" })).toBe(NAO_CONSEGUI_CONSULTAR);
  });

  it("cache contractual não inventa campo que não veio", () => {
    const cache = retratoDoCache({
      moope_external_id: "loc-9",
      retrato_locadora: { nome: "Bia", contrato_status: "ativo", days_late: 0 },
    });
    expect(cache?.nome).toBe("Bia");
    expect(cache?.placa).toBeNull();
  });

  it("disponibilidade e P3 continuam NAO_EXISTE", () => {
    expect(AUDITORIA_MOOPE_GESTAO.disponibilidade).toBe("NAO_EXISTE");
    expect(AUDITORIA_MOOPE_GESTAO.checklist).toBe("NAO_EXISTE");
    expect(AUDITORIA_MOOPE_GESTAO.cliente).toBe("EXISTE");
  });
});
