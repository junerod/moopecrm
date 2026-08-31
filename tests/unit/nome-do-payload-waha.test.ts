import { describe, expect, it } from "vitest";

import { conferirContratoWaha, lerRoteamentoWaha, nomeDoPayloadWaha } from "@/lib/waha/envelope";

const ler = (corpo: unknown) => {
  const r = lerRoteamentoWaha(JSON.stringify(corpo));
  return r.ok ? conferirContratoWaha(r.envelope) : r;
};

describe("nomeDoPayloadWaha", () => {
  it("lê o pushName do TOPO — o formato que o WAHA documenta", () => {
    const r = ler({
      event: "message",
      session: "default",
      payload: { id: "x", from: "5531@c.us", pushName: "Cliente do Topo" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(nomeDoPayloadWaha(r.envelope.payload!)).toBe("Cliente do Topo");
  });

  it("lê o pushname minúsculo — o que /contacts/all devolve", () => {
    const r = ler({
      event: "message",
      session: "default",
      payload: { id: "x", from: "5531@c.us", pushname: "Agenda Minuscula" },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(nomeDoPayloadWaha(r.envelope.payload!)).toBe("Agenda Minuscula");
  });

  it("o NOWEB (_data) continua valendo quando o topo vem vazio", () => {
    const r = ler({
      event: "message",
      session: "default",
      payload: { id: "x", from: "5531@c.us", _data: { pushName: "Cliente NOWEB" } },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(nomeDoPayloadWaha(r.envelope.payload!)).toBe("Cliente NOWEB");
  });
});
