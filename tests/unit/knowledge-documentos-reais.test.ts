import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { mensagemDoErroDocumental } from "@/lib/ai/knowledge/erros-documentais";
import { metadadoPublicoDaFonte } from "@/lib/ai/knowledge/metadado-publico";
import { saudeDoConhecimento } from "@/lib/ai/knowledge/saude";
import { statusDoDocumento } from "@/lib/ai/knowledge/status-do-documento";
import { chaveDocumental, chavePertenceAOrg } from "@/lib/ai/knowledge/storage/caminho";
import { r2DocumentStorage } from "@/lib/ai/knowledge/storage/r2";
import {
  normalizarStorageProvider,
  providerPadraoDoConhecimento,
} from "@/lib/ai/knowledge/storage/resolver";
import { extractDocument } from "@/lib/ai/rag/extractors/registro";
import {
  medirQualidadePdf,
  pdfEstruturaLegivel,
  pdfPareceCriptografado,
} from "@/lib/ai/rag/extractors/pdf-classificar";
import { DocumentExtractError, extrairPoliticaDoBuffer } from "@/lib/ai/rag/ingest/policy";

const dir = join(process.cwd(), "tests/fixtures/knowledge");

function fixture(nome: string): Buffer {
  return readFileSync(join(dir, nome));
}

describe("qualidade e classificação PDF", () => {
  it("10 páginas e 30 chars não é sucesso", () => {
    const q = medirQualidadePdf(10, ["abc".repeat(10)]);
    expect(q.classification).toBe("IMAGE_ONLY");
  });

  it("página textual curta mas suficiente passa", () => {
    const q = medirQualidadePdf(1, ["Produto Plataforma Elevatoria preco 742,30 codigo PDFREAL-8127"]);
    expect(q.classification).toBe("TEXTUAL");
  });

  it("detecta /Encrypt no buffer", () => {
    expect(pdfPareceCriptografado(fixture("pdf-protegido.pdf"))).toBe(true);
    expect(pdfPareceCriptografado(fixture("pdf-real-plataforma.pdf"))).toBe(false);
    expect(pdfEstruturaLegivel(fixture("pdf-real-plataforma.pdf"))).toBe(true);
  });
});

describe("extractores com fixtures reais", () => {
  it("PDF textual gerado fora do montarPdfTextual", async () => {
    const doc = await extractDocument({
      buffer: fixture("pdf-real-plataforma.pdf"),
      filename: "pdf-real-plataforma.pdf",
      mimeType: "application/pdf",
    });
    expect(doc.text).toMatch(/742,30/);
    expect(doc.text).toMatch(/PDFREAL-8127/);
    expect(doc.metadata.classification).toBe("TEXTUAL");
    expect(doc.metadata.ocrUsed).toBe(false);
  });

  it("PDF multipage", async () => {
    const doc = await extractDocument({
      buffer: fixture("pdf-multipage.pdf"),
      filename: "pdf-multipage.pdf",
    });
    expect(doc.metadata.pageCount).toBeGreaterThanOrEqual(2);
    expect(doc.text).toMatch(/PDFREAL-8127|742,30|Plataforma/);
  });

  it("PDF image-only vira needs_ocr sem fingir sucesso", async () => {
    const doc = await extractDocument({
      buffer: fixture("pdf-escaneado.pdf"),
      filename: "pdf-escaneado.pdf",
    });
    expect(doc.metadata.errorCode).toBe("pdf_needs_ocr");
    expect(doc.metadata.classification).toBe("IMAGE_ONLY");
    expect(doc.text.length).toBeLessThan(40);
  });

  it("PDF protegido falha com código próprio", async () => {
    await expect(
      extractDocument({
        buffer: fixture("pdf-protegido.pdf"),
        filename: "pdf-protegido.pdf",
      }),
    ).rejects.toMatchObject({ code: "pdf_encrypted" });
  });

  it("DOCX real com heading e tabela", async () => {
    const r = await extrairPoliticaDoBuffer(
      fixture("docx-compressor.docx"),
      "docx",
      "Tabela Comercial.docx",
    );
    expect(r.extractedText).toMatch(/918,40/);
    expect(r.extractedText).toMatch(/DOCX-5512/);
    expect(r.extractor).toBe("mammoth");
    expect(r.pages.some((p) => p.secao === "Locacoes" || (p.texto ?? "").includes("Locacoes"))).toBe(
      true,
    );
  });

  it("TXT e MD", async () => {
    const txt = await extractDocument({ buffer: fixture("regras.txt"), filename: "regras.txt" });
    const md = await extractDocument({ buffer: fixture("garantias.md"), filename: "garantias.md" });
    expect(txt.text).toMatch(/TXT-4401/);
    expect(md.text).toMatch(/MD-2208/);
    expect(md.sections?.some((s) => s.secao === "Garantias")).toBe(true);
  });
});

describe("mensagens e status", () => {
  it("não usa mais a frase genérica como único diagnóstico", () => {
    expect(mensagemDoErroDocumental("pdf_needs_ocr")).toMatch(/digitalizado/);
    expect(mensagemDoErroDocumental("pdf_encrypted")).toMatch(/senha/);
    expect(mensagemDoErroDocumental("pdf_corrupt")).toMatch(/danificado/);
    expect(mensagemDoErroDocumental("extract_failed")).not.toMatch(/danificado/);
    expect(mensagemDoErroDocumental("pdf_needs_ocr")).not.toBe(
      "Não foi possível encontrar texto neste documento.",
    );
  });

  it("status ocr_necessario", () => {
    expect(
      statusDoDocumento({
        status: "ready",
        last_index_status: null,
        last_indexed_at: null,
        chunks_count: 0,
        source_metadata: { extract_status: "needs_ocr", error_code: "pdf_needs_ocr" },
      }),
    ).toBe("ocr_necessario");
  });
});

describe("storage e tenant", () => {
  it("path inclui org e recusa org vizinha", () => {
    const orgA = "11111111-1111-1111-1111-111111111111";
    const orgB = "22222222-2222-2222-2222-222222222222";
    const key = chaveDocumental(orgA, "src-1", "manual.pdf");
    expect(key.startsWith(`${orgA}/`)).toBe(true);
    expect(chavePertenceAOrg(key, orgA)).toBe(true);
    expect(chavePertenceAOrg(key, orgB)).toBe(false);
  });

  it("metadado público não vaza storage_key", () => {
    const pub = metadadoPublicoDaFonte({
      filename: "Manual.pdf",
      storage_key: "org/src/Manual.pdf",
      blob_path: "org/src/Manual.pdf",
      extracted_text: "SEGREDO",
      extract_status: "needs_ocr",
      error_code: "pdf_needs_ocr",
    });
    expect(pub.extract_status).toBe("needs_ocr");
    expect(JSON.stringify(pub)).not.toMatch(/storage_key|blob_path|SEGREDO/);
  });

  it("provider default é supabase", () => {
    expect(normalizarStorageProvider("")).toBe("supabase");
    expect(normalizarStorageProvider("R2")).toBe("r2");
    expect(saudeDoConhecimento().ocr).toBe("nao_configurado");
  });

  it("R2 configurado ganha — PDF de cliente não vai para o disco da VPS", () => {
    expect(providerPadraoDoConhecimento({ providerEnv: "supabase", r2Pronto: true })).toBe("r2");
    expect(providerPadraoDoConhecimento({ providerEnv: "supabase", r2Pronto: false })).toBe(
      "supabase",
    );
  });

  it("R2 mock: put/get/delete no prefixo do tenant", async () => {
    const bag = new Map<string, Buffer>();
    const org = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const storage = r2DocumentStorage({
      client: {
        send: async (cmd: { input?: { Key?: string; Body?: Buffer } }) => {
          const name = cmd.constructor.name;
          const key = cmd.input?.Key ?? "";
          if (name === "PutObjectCommand") {
            bag.set(key, Buffer.from(cmd.input?.Body ?? []));
            return {};
          }
          if (name === "GetObjectCommand") {
            const body = bag.get(key);
            return {
              Body: { transformToByteArray: async () => new Uint8Array(body ?? []) },
            };
          }
          if (name === "DeleteObjectCommand") {
            bag.delete(key);
            return {};
          }
          if (name === "HeadObjectCommand") {
            if (!bag.has(key)) throw new Error("missing");
            return {};
          }
          return {};
        },
      } as never,
    });

    const key = chaveDocumental(org, "doc-1", "original.pdf");
    await storage.put({
      organizationId: org,
      key,
      body: Buffer.from("pdf"),
      contentType: "application/pdf",
    });
    expect(await storage.exists({ organizationId: org, key })).toBe(true);
    expect((await storage.get({ organizationId: org, key })).toString()).toBe("pdf");
    await expect(
      storage.get({
        organizationId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        key,
      }),
    ).rejects.toBeInstanceOf(DocumentExtractError);
    await storage.delete({ organizationId: org, key });
    expect(await storage.exists({ organizationId: org, key })).toBe(false);
  });
});

describe("imagem de produção leva o leitor de PDF", () => {
  it("next.config rastreia canvas e pdfjs no standalone", () => {
    const cfg = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(cfg).toMatch(/@napi-rs\+canvas/);
    expect(cfg).toMatch(/pdfjs-dist/);
    expect(cfg).toMatch(/serverExternalPackages/);
  });
});

describe("DocumentExtractError", () => {
  it("docx inválido", async () => {
    await expect(
      extractDocument({ buffer: Buffer.from("nao e zip"), filename: "x.docx" }),
    ).rejects.toMatchObject({ code: "docx_invalid" });
  });
});
