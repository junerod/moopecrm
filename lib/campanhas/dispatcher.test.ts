import { describe, expect, it } from "vitest";

import { diagnosticoDeDispatch, viaDoEmail, viaDoWhatsapp } from "@/lib/campanhas/diagnostico";
import { montarEnvelopeDeEmail } from "@/lib/campanhas/email-envelope";
import { reescreverRascunhoLocal } from "@/lib/campanhas/ia-rascunho";
import { montarLinhasDeDestinatarios } from "@/lib/campanhas/materializar";
import { CLASSIFICACAO_CAMPANHA } from "@/lib/campanhas/tipos";

describe("dispatcher e diagnóstico", () => {
  it("mock explícito nunca vira real", () => {
    expect(viaDoWhatsapp({ modo: "mock", provider: null, templateId: "t", adapterConfigured: true })).toBe(
      "mock",
    );
    expect(viaDoEmail({ modo: "mock", configurado: true })).toBe("mock");
  });

  it("real sem adapter fica indisponível", () => {
    expect(viaDoEmail({ modo: "real", configurado: false })).toBe("indisponivel");
  });

  it("classificação continua campaign_commercial", () => {
    expect(CLASSIFICACAO_CAMPANHA).toBe("campaign_commercial");
  });

  it("diagnóstico expõe campaign_dispatch_real", () => {
    const d = diagnosticoDeDispatch({ provider: null });
    expect(typeof d.campaign_dispatch_real).toBe("boolean");
  });

  it("QR com adapter configurado envia no fio existente", () => {
    expect(viaDoWhatsapp({ modo: "auto", provider: "waha", adapterConfigured: true })).toBe("real");
  });

  it("QR sem adapter no auto continua mock", () => {
    expect(viaDoWhatsapp({ modo: "auto", provider: "waha", adapterConfigured: false })).toBe("mock");
  });
});

describe("materialização em lote", () => {
  it("gera uma linha por canal e é idempotente na chave", () => {
    const linhas = montarLinhasDeDestinatarios({
      organizationId: "o1",
      campaignId: "c1",
      contactIds: ["a"],
      selecao: "ambos",
      contatos: [
        {
          id: "a",
          phone_number: "+5511999990001",
          email: "a@ex.com",
          is_blocked: false,
        },
      ],
    });
    expect(linhas).toHaveLength(2);
    expect(new Set(linhas.map((l) => l.channel)).size).toBe(2);
  });
});

describe("envelope de e-mail", () => {
  it("reusa o texto e inclui rodapé", () => {
    const e = montarEnvelopeDeEmail({
      nomeCampanha: "Oferta",
      corpo: "Olá Maria",
      rodape: { nome: "Locadora X", telefone: "+5511", email: "a@x.com" },
    });
    expect(e.html).toContain("Olá Maria");
    expect(e.html).toContain("Locadora X");
    expect(e.text).toContain("sair da lista");
  });
});

describe("IA no draft", () => {
  it("não envia e só devolve texto", () => {
    const r = reescreverRascunhoLocal("Oi!!  tudo   bem", "profissional");
    expect(r.texto.includes("  ")).toBe(false);
    expect(r.versoes.length).toBeGreaterThan(0);
  });
});
