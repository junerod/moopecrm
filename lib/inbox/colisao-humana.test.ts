import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { decisaoDeColisaoHumana } from "./colisao-humana";

const EU = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

describe("decisaoDeColisaoHumana", () => {
  it("sem dono: pode enviar", () => {
    expect(decisaoDeColisaoHumana({ viewerUserId: EU, assignedToUserId: null })).toEqual({
      podeEnviar: true,
    });
  });

  it("eu sou o dono: pode enviar", () => {
    expect(decisaoDeColisaoHumana({ viewerUserId: EU, assignedToUserId: EU })).toEqual({
      podeEnviar: true,
    });
  });

  it("outro humano é o dono: não envia", () => {
    expect(decisaoDeColisaoHumana({ viewerUserId: EU, assignedToUserId: OUTRO })).toEqual({
      podeEnviar: false,
      ownerId: OUTRO,
    });
  });
});

describe("o POST /messages aplica a colisão ANTES do claim", () => {
  it("o handler consulta decisaoDeColisaoHumana e recusa com 403", () => {
    const fonte = readFileSync(join(__dirname, "../../app/api/v1/messages/_handler.ts"), "utf8");
    expect(fonte).toContain("decisaoDeColisaoHumana");
    expect(fonte).toContain("Esta conversa pertence a outro atendente");
    const colisao = fonte.indexOf("const colisao = decisaoDeColisaoHumana");
    const claim = fonte.indexOf("await assumirPeloEnvioHumano");
    expect(colisao).toBeGreaterThan(0);
    expect(colisao).toBeLessThan(claim);
  });
});
