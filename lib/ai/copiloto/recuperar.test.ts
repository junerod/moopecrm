import { describe, expect, it } from "vitest";

import { buscarFaqDaOrg } from "./recuperar";

function dbFake(linhas: Array<{ organization_id: string; question: string; answer: string }>) {
  return {
    from(tabela: string) {
      const ctx: { org?: string; ids?: string[] } = {};
      const builder = {
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          if (col === "organization_id") ctx.org = String(val);
          return builder;
        },
        in(col: string, val: unknown[]) {
          if (col === "knowledge_source_id") ctx.ids = val as string[];
          return builder;
        },
        limit() {
          return builder;
        },
        then(resolve: (v: { data: unknown }) => void) {
          if (tabela === "ai_knowledge_sources") {
            resolve({ data: [{ id: "fonte-a", name: "Empresa A" }] });
            return;
          }
          const org = ctx.org;
          resolve({
            data: linhas
              .filter((l) => l.organization_id === org)
              .map((l) => ({
                question: l.question,
                answer: l.answer,
                knowledge_source_id: "fonte-a",
              })),
          });
        },
      };
      return builder;
    },
  };
}

describe("isolamento do cadastro de conhecimento", () => {
  const linhas = [
    { organization_id: "org-a", question: "Alfa", answer: "Produto Alfa custa R$ 123." },
    { organization_id: "org-b", question: "Alfa", answer: "Produto Alfa custa R$ 999." },
  ];

  it("tenant A não lê o preço do tenant B", async () => {
    const hits = await buscarFaqDaOrg(dbFake(linhas) as never, "org-a", "Quanto custa o Produto Alfa?");
    expect(hits.some((h) => h.content.includes("123"))).toBe(true);
    expect(hits.some((h) => h.content.includes("999"))).toBe(false);
  });

  it("tenant B não lê o preço do tenant A", async () => {
    const hits = await buscarFaqDaOrg(dbFake(linhas) as never, "org-b", "Quanto custa o Produto Alfa?");
    expect(hits.some((h) => h.content.includes("999"))).toBe(true);
    expect(hits.some((h) => h.content.includes("123"))).toBe(false);
  });
});
