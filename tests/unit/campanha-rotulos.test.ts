import { describe, expect, it } from "vitest";

import { rotuloStatusCampanha, tomStatusCampanha } from "@/lib/campanhas/rotulos";

describe("rótulos de campanha", () => {
  it("traduz status conhecido e não inventa o desconhecido", () => {
    expect(rotuloStatusCampanha("draft")).toBe("Rascunho");
    expect(rotuloStatusCampanha("running")).toBe("Enviando");
    expect(rotuloStatusCampanha("xyz")).toBe("xyz");
  });

  it("tom de falha é red", () => {
    expect(tomStatusCampanha("failed")).toBe("red");
  });
});
