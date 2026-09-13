import { describe, expect, it } from "vitest";

import { formatarTelefone, iniciaisDoNome } from "@/lib/contacts/formatar-telefone";

describe("formatarTelefone", () => {
  it("formata celular BR", () => {
    expect(formatarTelefone("+5511961169244")).toBe("+55 11 96116-9244");
  });

  it("some quando vazio", () => {
    expect(formatarTelefone(null)).toBeNull();
    expect(formatarTelefone("  ")).toBeNull();
  });

  it("não inventa máscara para número curto", () => {
    expect(formatarTelefone("1234")).toBe("1234");
  });
});

describe("iniciaisDoNome", () => {
  it("pega primeira e última", () => {
    expect(iniciaisDoNome("Maria Silva")).toBe("MS");
  });
});
