import { describe, expect, it } from "vitest";

import { rotuloDoDono } from "./rotulo-do-dono";

const EU = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

describe("rotuloDoDono", () => {
  it("SEM DONO (fila): Fila", () => {
    expect(rotuloDoDono({ viewerUserId: EU, comando: { quem: "aguardando" } })).toEqual({
      chave: "fila",
      texto: "Fila",
    });
  });

  it("EU: Você está atendendo", () => {
    expect(
      rotuloDoDono({
        viewerUserId: EU,
        comando: { quem: "humano", userId: EU, nome: "João" },
      }),
    ).toEqual({ chave: "eu", texto: "Você está atendendo" });
  });

  it("OUTRO: João está atendendo", () => {
    expect(
      rotuloDoDono({
        viewerUserId: EU,
        comando: { quem: "humano", userId: OUTRO, nome: "João" },
      }),
    ).toEqual({ chave: "outro", texto: "João está atendendo" });
  });

  it("IA: Automático atendendo", () => {
    expect(rotuloDoDono({ viewerUserId: EU, comando: { quem: "automatico" } })).toEqual({
      chave: "ia",
      texto: "Automático atendendo",
    });
  });
});
