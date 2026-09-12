import { describe, expect, it } from "vitest";

import {
  devePingarHeartbeat,
  HEARTBEAT_PING_MS,
  statusDoAtendente,
  vistoHa,
} from "./heartbeat";

const agora = new Date("2026-09-12T12:00:00.000Z");

describe("devePingarHeartbeat", () => {
  it("não pinga se indisponível", () => {
    expect(
      devePingarHeartbeat({
        isAvailable: false,
        visivel: true,
        agora,
        ultimoPingEm: null,
      }),
    ).toBe(false);
  });

  it("não pinga com a aba oculta", () => {
    expect(
      devePingarHeartbeat({
        isAvailable: true,
        visivel: false,
        agora,
        ultimoPingEm: null,
      }),
    ).toBe(false);
  });

  it("pinga no primeiro tick visível e disponível", () => {
    expect(
      devePingarHeartbeat({
        isAvailable: true,
        visivel: true,
        agora,
        ultimoPingEm: null,
      }),
    ).toBe(true);
  });

  it("respeita o intervalo de 2 min", () => {
    expect(HEARTBEAT_PING_MS).toBe(120_000);
    expect(
      devePingarHeartbeat({
        isAvailable: true,
        visivel: true,
        agora,
        ultimoPingEm: new Date(agora.getTime() - 60_000),
      }),
    ).toBe(false);
    expect(
      devePingarHeartbeat({
        isAvailable: true,
        visivel: true,
        agora,
        ultimoPingEm: new Date(agora.getTime() - 120_000),
      }),
    ).toBe(true);
  });
});

describe("statusDoAtendente", () => {
  it("indisponível não mente Online", () => {
    expect(
      statusDoAtendente({
        isAvailable: false,
        lastHeartbeatAt: agora.toISOString(),
        agora,
      }),
    ).toEqual({ chave: "indisponivel", rotulo: "Indisponível" });
  });

  it("disponível com heartbeat fresco: Disponível", () => {
    expect(
      statusDoAtendente({
        isAvailable: true,
        lastHeartbeatAt: agora.toISOString(),
        agora,
      }),
    ).toEqual({ chave: "disponivel", rotulo: "Disponível" });
  });

  it("disponível com heartbeat velho: Offline", () => {
    expect(
      statusDoAtendente({
        isAvailable: true,
        lastHeartbeatAt: new Date(agora.getTime() - 20 * 60_000).toISOString(),
        agora,
      }),
    ).toEqual({ chave: "offline", rotulo: "Offline" });
  });
});

describe("vistoHa", () => {
  it("formata minutos", () => {
    expect(vistoHa(new Date(agora.getTime() - 5 * 60_000), agora)).toBe("visto há 5 min");
  });
});
