import { describe, expect, it } from "vitest";

import { buscarDocumentosDaOrg, buscarFaqDaOrg } from "./recuperar";

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

  it("Produto Zeta sem cadastro não herda o preço do Alfa", async () => {
    const hits = await buscarFaqDaOrg(
      dbFake(linhas) as never,
      "org-a",
      "Quanto custa o Produto Zeta?",
    );
    expect(hits).toHaveLength(0);
  });
});

function dbDocs(fontes: Array<{ organization_id: string; name: string; filename: string; texto: string }>) {
  return {
    from(tabela: string) {
      const ctx: { org?: string; tipo?: string } = {};
      const builder = {
        select() {
          return builder;
        },
        eq(col: string, val: unknown) {
          if (col === "organization_id") ctx.org = String(val);
          if (col === "source_type") ctx.tipo = String(val);
          return builder;
        },
        then(resolve: (v: { data: unknown }) => void) {
          if (tabela !== "ai_knowledge_sources") {
            resolve({ data: [] });
            return;
          }
          resolve({
            data: fontes
              .filter((f) => f.organization_id === ctx.org)
              .map((f) => ({
                id: `fonte-${f.organization_id}`,
                name: f.name,
                source_type: "policy",
                source_metadata: { filename: f.filename, extracted_text: f.texto },
              })),
          });
        },
      };
      return builder;
    },
  };
}

describe("isolamento de documento extraído", () => {
  const fontes = [
    {
      organization_id: "org-a",
      name: "Manual A",
      filename: "manual-a.pdf",
      texto: "Gerador Industrial MOOPE TESTE KB diária R$ 347,80 código AZUL-9271",
    },
    {
      organization_id: "org-b",
      name: "Manual B",
      filename: "manual-b.pdf",
      texto: "Politica interna sem o produto exclusivo da outra empresa",
    },
  ];

  it("org B não recupera texto, chunk nem nome do arquivo da org A", async () => {
    const hits = await buscarDocumentosDaOrg(
      dbDocs(fontes) as never,
      "org-b",
      "Qual a diária do Gerador Industrial MOOPE TESTE KB?",
    );
    expect(hits).toHaveLength(0);
    expect(JSON.stringify(hits)).not.toMatch(/347,80|AZUL-9271|manual-a/);
  });

  it("org A encontra o dado exclusivo do próprio PDF", async () => {
    const hits = await buscarDocumentosDaOrg(
      dbDocs(fontes) as never,
      "org-a",
      "Qual a diária do Gerador Industrial MOOPE TESTE KB?",
    );
    expect(hits.some((h) => h.content.includes("347,80"))).toBe(true);
    expect(hits[0]?.fonte).toBe("manual-a.pdf");
  });
});
