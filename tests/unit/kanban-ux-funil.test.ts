/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";

import {
  ETAPAS_FUNIL_SUPORTE,
  NOME_FUNIL_SUPORTE,
  VOCABULARIO_SUPORTE,
} from "@/lib/pipelines/funil-suporte";
import {
  alvoDaSeta,
  chipNoPonto,
  LARGURA_PASSO_COLUNA,
  rodaViraLateral,
} from "@/lib/kanban/board-scroll";
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

describe("seta do quadro", () => {
  const inicios = [0, 332, 664, 996, 1328];
  const max = 1100;

  it("avança para o início da próxima coluna, não um passo fixo", () => {
    expect(alvoDaSeta(inicios, 0, max, 1)).toBe(332);
    // Parado no meio da coluna 1 (a da esquerda cortada): vai para a 2 inteira.
    expect(alvoDaSeta(inicios, 500, max, 1)).toBe(664);
  });

  it("quase alinhada na próxima não anda 12px — pula a etapa de verdade", () => {
    expect(alvoDaSeta(inicios, 320, max, 1)).toBe(664);
    expect(alvoDaSeta(inicios, 331, max, 1)).toBe(664);
  });

  it("volta para o início da coluna anterior", () => {
    expect(alvoDaSeta(inicios, 664, max, -1)).toBe(332);
    expect(alvoDaSeta(inicios, 500, max, -1)).toBe(332);
    expect(alvoDaSeta(inicios, 332, max, -1)).toBe(0);
  });

  it("não passa do fim nem do começo", () => {
    expect(alvoDaSeta(inicios, 1000, max, 1)).toBe(max);
    expect(alvoDaSeta(inicios, 0, max, -1)).toBe(0);
  });
});

describe("roda do mouse no quadro", () => {
  const base = { deltaX: 0, deltaY: 100, ctrlKey: false };

  it("fora de lista, ou em lista que não rola, vira rolagem lateral", () => {
    expect(rodaViraLateral({ ...base, lista: null })).toBe(true);
    expect(rodaViraLateral({ ...base, lista: { scrollHeight: 300, clientHeight: 600 } })).toBe(true);
  });

  it("em lista comprida, a roda continua descendo a coluna", () => {
    expect(rodaViraLateral({ ...base, lista: { scrollHeight: 2000, clientHeight: 600 } })).toBe(false);
  });

  it("não mexe em trackpad lateral nem no zoom", () => {
    expect(rodaViraLateral({ ...base, deltaX: 120, lista: null })).toBe(false);
    expect(rodaViraLateral({ ...base, ctrlKey: true, lista: null })).toBe(false);
  });
});

describe("soltar card no chip da etapa", () => {
  const chips = [
    { id: "novo", left: 0, right: 90, top: 0, bottom: 28 },
    { id: "agendado", left: 100, right: 190, top: 0, bottom: 28 },
  ];

  it("o ponteiro sobre o chip escolhe aquela etapa", () => {
    expect(chipNoPonto(chips, 140, 14)).toBe("agendado");
    expect(chipNoPonto(chips, 10, 14)).toBe("novo");
  });

  it("longe do trilho não escolhe nada", () => {
    expect(chipNoPonto(chips, 140, 200)).toBeNull();
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
