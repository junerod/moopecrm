import { describe, expect, it } from "vitest";

import {
  CHAVE_CAIU_EM,
  comCaiuEmSeFaltar,
  lerCaiuEm,
  semCaiuEm,
} from "@/lib/channels/caiu-em";

describe("hora em que a conexão caiu", () => {
  it("lê ISO válida e recusa lixo", () => {
    const quando = "2026-11-02T14:19:51.000Z";
    expect(lerCaiuEm({ [CHAVE_CAIU_EM]: quando })).toBe(Date.parse(quando));
    expect(lerCaiuEm({ [CHAVE_CAIU_EM]: "nao-e-data" })).toBeNull();
    expect(lerCaiuEm({})).toBeNull();
    expect(lerCaiuEm(null)).toBeNull();
  });

  it("grava só a PRIMEIRA queda do episódio", () => {
    const primeira = comCaiuEmSeFaltar({}, "2026-11-02T14:19:51.000Z");
    expect(primeira?.[CHAVE_CAIU_EM]).toBe("2026-11-02T14:19:51.000Z");
    expect(comCaiuEmSeFaltar(primeira, "2026-11-02T14:22:00.000Z")).toBeNull();
  });

  it("apaga depois do puxão — senão o recorte fica preso na queda velha", () => {
    const limpo = semCaiuEm({
      historico: { status: "pronto" },
      [CHAVE_CAIU_EM]: "2026-11-02T14:19:51.000Z",
    });
    expect(limpo[CHAVE_CAIU_EM]).toBeUndefined();
    expect(limpo.historico).toEqual({ status: "pronto" });
  });
});
