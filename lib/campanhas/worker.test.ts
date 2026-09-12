import { describe, expect, it } from "vitest";

import { campanhaComercialRealPermitida } from "@/lib/campanhas/capabilities";
import { agregarMetricas } from "@/lib/campanhas/metricas";
import { enviarCampanhaMock } from "@/lib/campanhas/mock-envio";
import { podeEnviarAgora } from "@/lib/campanhas/pacing";
import { destinatarioJaEnviado, podeTransitarCampanha } from "@/lib/campanhas/transicoes";
import { CLASSIFICACAO_CAMPANHA } from "@/lib/campanhas/tipos";

describe("capabilities da campanha", () => {
  it("WAHA não habilita campanha comercial real", () => {
    expect(campanhaComercialRealPermitida("waha")).toBe(false);
  });

  it("Meta/Zernio/Twilio podem (template oficial)", () => {
    expect(campanhaComercialRealPermitida("meta_cloud")).toBe(true);
    expect(campanhaComercialRealPermitida("zernio")).toBe(true);
    expect(campanhaComercialRealPermitida("twilio")).toBe(true);
  });
});

describe("mock de envio", () => {
  it("classifica campaign_commercial e não é operational_moope", () => {
    const e = enviarCampanhaMock({
      campaignId: "camp-1",
      contactId: "c1",
      destE164: "+5511999990001",
      body: "Olá Maria",
      provider: "meta_cloud",
    });
    expect(e.via).toBe("mock");
    expect(e.classificacao).toBe(CLASSIFICACAO_CAMPANHA);
    expect(e.classificacao).not.toBe("operational_moope");
    expect(e.classificacao).not.toBe("alerta_interno_atendente");
  });
});

describe("pacing e idempotência", () => {
  it("respeita piso de 5s", () => {
    const agora = new Date("2026-09-12T12:00:05.000Z");
    expect(
      podeEnviarAgora({
        lastSentAt: "2026-09-12T12:00:01.000Z",
        agora,
        pacingMs: 5000,
      }),
    ).toBe(false);
    expect(
      podeEnviarAgora({
        lastSentAt: "2026-09-12T11:59:59.000Z",
        agora,
        pacingMs: 5000,
      }),
    ).toBe(true);
  });

  it("já enviado não reenvia", () => {
    expect(destinatarioJaEnviado("sent")).toBe(true);
    expect(destinatarioJaEnviado("replied")).toBe(true);
    expect(destinatarioJaEnviado("pending")).toBe(false);
  });

  it("cancelamento só de estados vivos", () => {
    expect(podeTransitarCampanha("running", "cancelled")).toBe(true);
    expect(podeTransitarCampanha("completed", "cancelled")).toBe(false);
    expect(podeTransitarCampanha("draft", "running")).toBe(true);
  });
});

describe("métricas", () => {
  it("agrega enviadas/entregues/respostas/opt-out/leads", () => {
    const m = agregarMetricas([
      { status: "sent" },
      { status: "delivered" },
      { status: "replied", lead_id: "l1" },
      { status: "skipped" },
      { status: "failed" },
      { status: "pending" },
    ]);
    expect(m.enviadas).toBe(3);
    expect(m.entregues).toBe(2);
    expect(m.respondidas).toBe(1);
    expect(m.opt_outs).toBe(1);
    expect(m.falharam).toBe(1);
    expect(m.leads_associados).toBe(1);
    expect(m.pendentes).toBe(1);
  });
});
