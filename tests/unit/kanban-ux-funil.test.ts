/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  ETAPAS_FUNIL_SUPORTE,
  NOME_FUNIL_SUPORTE,
  VOCABULARIO_SUPORTE,
} from "@/lib/pipelines/funil-suporte";
import { LARGURA_PASSO_COLUNA } from "@/lib/kanban/board-scroll";
import { bateBuscaDaEtapa } from "@/lib/kanban/stage-focus-busca";

describe("funil suporte (molde)", () => {
  it("tem exatamente uma etapa won e uma lost", () => {
    expect(ETAPAS_FUNIL_SUPORTE.filter((e) => e.is_won)).toHaveLength(1);
    expect(ETAPAS_FUNIL_SUPORTE.filter((e) => e.is_lost)).toHaveLength(1);
    expect(ETAPAS_FUNIL_SUPORTE.filter((e) => e.is_won && e.is_lost)).toHaveLength(0);
  });

  it("nome e vocabulário batem com o combinado de UX", () => {
    expect(NOME_FUNIL_SUPORTE).toBe("Suporte");
    expect(VOCABULARIO_SUPORTE.lead).toBe("Ticket");
    expect(VOCABULARIO_SUPORTE.won).toBe("Resolvido");
    expect(ETAPAS_FUNIL_SUPORTE.map((e) => e.name)).toEqual([
      "Novo",
      "Em atendimento",
      "Aguardando cliente",
      "Resolvido",
      "Não resolvido",
    ]);
  });
});

describe("board scroll (constantes)", () => {
  it("passo de coluna = w-80 + gap-3", () => {
    expect(LARGURA_PASSO_COLUNA).toBe(320 + 12);
  });
});

describe("bateBuscaDaEtapa", () => {
  it("filtra por título e telefone", () => {
    const elev = {
      title: "Elevmed",
      contato: { display_name: "Elevmed", phone_number: "+5511999990000" },
    };
    const fatima = {
      title: "Fatima Ely",
      contato: { display_name: "Fatima", phone_number: null },
    };
    expect(bateBuscaDaEtapa(elev, "elev")).toBe(true);
    expect(bateBuscaDaEtapa(fatima, "elev")).toBe(false);
    expect(bateBuscaDaEtapa(elev, "9999")).toBe(true);
    expect(bateBuscaDaEtapa(elev, "")).toBe(true);
  });
});
