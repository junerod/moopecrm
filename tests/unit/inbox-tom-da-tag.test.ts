import { describe, expect, it } from "vitest";

import { tomDaTag, tomDoSelo, TOM_DA_ABA, TOM_DO_PAPEL } from "@/lib/inbox/tom-da-tag";

describe("tomDaTag — mesma palavra, mesma cor", () => {
  it("é estável para o mesmo nome", () => {
    expect(tomDaTag("plataforma")).toBe(tomDaTag("Plataforma"));
    expect(tomDaTag("rastreamento")).toBe(tomDaTag("rastreamento"));
  });

  it("espalha um vocabulário curto em mais de um tom", () => {
    const tons = ["plataforma", "rastreamento", "vip", "urgente", "suporte"].map(
      tomDaTag,
    );
    expect(new Set(tons).size).toBeGreaterThan(1);
  });
});

describe("tomos do inbox — significado, não enfeite", () => {
  it("papel e selo batem com a operação", () => {
    expect(TOM_DO_PAPEL.cliente).toBe("green");
    expect(TOM_DO_PAPEL.lead).toBe("blue");
    expect(tomDoSelo("nao_salvo")).toBe("red");
    expect(tomDoSelo("lead", "quente")).toBe("red");
    expect(tomDoSelo("lead", "frio")).toBe("cyan");
  });

  it("cada aba da lista tem tom próprio", () => {
    const tons = Object.values(TOM_DA_ABA);
    expect(new Set(tons).size).toBe(tons.length);
    expect(TOM_DA_ABA.unassigned).toBe("amber");
    expect(TOM_DA_ABA.mine).toBe("blue");
    expect(TOM_DA_ABA.ai).toBe("violet");
  });
});
