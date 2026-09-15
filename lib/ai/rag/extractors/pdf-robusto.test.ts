import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = (nome: string) => readFileSync(join(process.cwd(), "tests/fixtures", nome));

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/ai/rag/extractors/pdf");
});

describe("extractPdfRobusto — PDF válido não é 'danificado'", () => {
  it("cabeçalho sem %%EOF é que está cortado", async () => {
    const { pdfEstruturaLegivel, bufferParecePdf } = await import(
      "@/lib/ai/rag/extractors/pdf-classificar"
    );
    const bom = fixture("sample-text.pdf");
    expect(bufferParecePdf(bom)).toBe(true);
    expect(pdfEstruturaLegivel(bom)).toBe(true);
    expect(pdfEstruturaLegivel(Buffer.from("%PDF-1.4\n1 0 obj"))).toBe(false);
    expect(pdfEstruturaLegivel(Buffer.from("nao e pdf"))).toBe(false);
  });

  it("pdfjs falha + fluxo vazio + arquivo inteiro → extract_failed, não pdf_corrupt", async () => {
    vi.doMock("@/lib/ai/rag/extractors/pdf", () => ({
      PdfExtractError: class PdfExtractError extends Error {
        constructor(message: string, public readonly cause?: unknown) {
          super(message);
          this.name = "PdfExtractError";
        }
      },
      extractPdfDocument: vi.fn(async () => {
        throw new Error("DOMMatrix is not defined");
      }),
    }));
    vi.doMock("@/lib/ai/rag/extractors/pdf-fluxo", () => ({
      extrairPdfPorFluxo: () => ({ texto: "", paginas: [] }),
    }));

    const { extractPdfRobusto } = await import("@/lib/ai/rag/extractors/pdf-robusto");
    await expect(extractPdfRobusto(fixture("sample-text.pdf"))).rejects.toMatchObject({
      code: "extract_failed",
    });
  });

  it("manual real da operação (HTML→PDF) tem texto — não está danificado", async () => {
    const caminho = "/Users/junerod/Downloads/frotas.moope.com.br_manualassinaturas.pdf";
    if (!existsSync(caminho)) return;
    const { extractPdfRobusto } = await import("@/lib/ai/rag/extractors/pdf-robusto");
    const doc = await extractPdfRobusto(readFileSync(caminho));
    expect(doc.metadata.errorCode).toBeUndefined();
    expect(doc.metadata.classification).toBe("TEXTUAL");
    expect(doc.text).toMatch(/assinatura/i);
  });

  it("buffer sem %PDF- continua pdf_corrupt", async () => {
    const { extractPdfRobusto } = await import("@/lib/ai/rag/extractors/pdf-robusto");
    await expect(extractPdfRobusto(Buffer.from("isto nao e pdf"))).rejects.toMatchObject({
      code: "pdf_corrupt",
    });
  });
});
