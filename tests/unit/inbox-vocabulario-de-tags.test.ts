import { describe, expect, it } from "vitest";

import { contarTags, ordenarVocabulario } from "@/lib/inbox/vocabulario-de-tags";

describe("vocabulário de tags — oficial + o que a operação já usa", () => {
  it("a tag criada ontem volta como sugestão, sem segundo catálogo", () => {
    const contagem = contarTags([
      { tags: ["plataforma", "saas"] },
      { tags: ["plataforma"] },
      { tags: ["Rastreamento"] },
    ]);
    const lista = ordenarVocabulario(contagem, ["vip"]);
    expect(lista[0]).toBe("plataforma");
    expect(lista).toContain("rastreamento");
    expect(lista).toContain("vip");
  });

  it("oficial sem uso continua na lista — senão some o vocabulário que ninguém aplicou ainda", () => {
    const lista = ordenarVocabulario(new Map(), ["urgente"]);
    expect(lista).toEqual(["urgente"]);
  });

  it("deduplica e ignora vazio", () => {
    const contagem = contarTags([{ tags: [" vip ", "vip", ""] }, { tags: null }]);
    expect([...contarTags([{ tags: ["vip"] }]).keys()]).toEqual(["vip"]);
    expect(ordenarVocabulario(contagem)).toEqual(["vip"]);
  });
});
