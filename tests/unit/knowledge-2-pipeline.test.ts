import { describe, expect, it } from "vitest";

import { metadadoPublicoDaFonte } from "@/lib/ai/knowledge/metadado-publico";
import { montarPromptOrganizar } from "@/lib/ai/knowledge/organizar";
import { statusDoDocumento } from "@/lib/ai/knowledge/status-do-documento";
import { chunkPolicyText, normalizarTextoPolitica, pedacosDePolitica } from "@/lib/ai/rag/ingest/policy";
import { sanitizarNomeDoArquivo } from "@/lib/ai/rag/nome-do-arquivo";
import { montarPdfTextual } from "@/lib/ai/rag/pdf-textual";

describe("sanitizarNomeDoArquivo", () => {
  it("descarta caminho e caracteres de controle", () => {
    expect(sanitizarNomeDoArquivo("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(sanitizarNomeDoArquivo("preco\u0000final.pdf")).toBe("precofinal.pdf");
  });

  it("não deixa o nome vazio", () => {
    expect(sanitizarNomeDoArquivo("   ")).toBe("arquivo");
  });
});

describe("statusDoDocumento", () => {
  it("marca indexando quando ready sem last_indexed_at", () => {
    expect(
      statusDoDocumento({
        status: "ready",
        last_index_status: null,
        last_indexed_at: null,
        chunks_count: 0,
      }),
    ).toBe("indexando");
  });

  it("marca pronto só com chunks gravados", () => {
    expect(
      statusDoDocumento({
        status: "ready",
        last_index_status: "success",
        last_indexed_at: "2026-09-13T12:00:00Z",
        chunks_count: 3,
      }),
    ).toBe("pronto");
  });

  it("marca erro sem vazar detalhe de embedding", () => {
    expect(
      statusDoDocumento({
        status: "failed",
        last_index_status: "failed",
        last_indexed_at: null,
        chunks_count: 0,
      }),
    ).toBe("erro");
  });
});

describe("metadadoPublicoDaFonte", () => {
  it("nunca devolve blob_path nem texto extraído", () => {
    const pub = metadadoPublicoDaFonte({
      filename: "Manual.pdf",
      blob_path: "org/uuid.pdf",
      extracted_text: "SEGREDO",
      uploaded_by: "user-1",
      size_bytes: 1200,
      page_count: 2,
    });
    expect(pub).toEqual({
      filename: "Manual.pdf",
      size_bytes: 1200,
      page_count: 2,
    });
    expect(JSON.stringify(pub)).not.toMatch(/blob_path|SEGREDO|user-1/);
  });
});

describe("normalização e chunk de política", () => {
  it("colapsa linhas em branco e corta pedaços com página", () => {
    const texto = normalizarTextoPolitica("Alfa\r\n\n\n\nBeta");
    expect(texto).toBe("Alfa\n\nBeta");
    const pedacos = pedacosDePolitica("curto", [{ pagina: 7, texto: "Diária R$ 347,80" }]);
    expect(pedacos[0]?.page).toBe(7);
    expect(pedacos[0]?.content).toContain("347,80");
  });

  it("respeita heading de markdown", () => {
    const chunks = chunkPolicyText("## Produto\nGerador\n## Preço\nR$ 10");
    expect(chunks.some((c) => c.includes("Gerador"))).toBe(true);
  });
});

describe("Organizar com IA — prompt", () => {
  it("não manda gravar e inclui o texto original", () => {
    const p = montarPromptOrganizar("Caução 1234", "Preços");
    expect(p).toContain("Caução 1234");
    expect(p).toContain("Assunto: Preços");
    expect(p).not.toMatch(/salve|grave|persista/i);
  });
});

describe("PDF textual de fixture", () => {
  it("é um PDF 1.4 que o extrator lê com o código exclusivo", async () => {
    const buf = montarPdfTextual([
      "AZUL-9271 Gerador Industrial MOOPE TESTE KB Diaria R$ 347,80",
    ]);
    expect(buf.subarray(0, 8).toString()).toBe("%PDF-1.4");
    const { extractPdfDocument } = await import("@/lib/ai/rag/extractors/pdf");
    const doc = await extractPdfDocument(buf);
    expect(doc.texto).toContain("AZUL-9271");
    expect(doc.texto).toContain("347,80");
    expect(doc.pageCount).toBe(1);
    expect(doc.paginas[0]?.pagina).toBe(1);
  });
});
