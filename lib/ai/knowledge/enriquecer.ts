/**
 * Depois da extração barata: Vision seletiva + normalização + derivado.
 * Nunca apaga o texto original.
 */

import { ehExtensaoImagem } from "@/lib/ai/rag/extractors/imagem";
import type { PaginaOuSecao } from "@/lib/ai/rag/extractors/contrato";
import { renderizarPaginasPdf } from "@/lib/ai/rag/ocr/render-pdf";
import { analisarDocumentoVisual, type AnaliseVisual } from "@/lib/ai/knowledge/visual/analisar";
import { chunksDoDerivado, gerarConhecimentoDerivado } from "@/lib/ai/knowledge/visual/derivado";
import { paginasQuePedemVision } from "@/lib/ai/knowledge/visual/heuristica";
import { normalizarParaRetrieval } from "@/lib/ai/knowledge/visual/normalizar";

export interface PaginaVisual {
  pagina: number;
  descricao: string;
  tipo?: string;
  texto_visivel: string[];
  model?: string;
}

export interface ProcessamentoDocumental {
  pages_total: number;
  pages_text: number;
  pages_ocr: number;
  pages_vision: number;
  vision_status: "done" | "unavailable" | "skipped" | "partial";
  extract_status: string;
}

export interface Enriquecimento {
  pages: PaginaOuSecao[];
  extractedText: string;
  visual_pages: PaginaVisual[];
  derived_chunks: Array<{ content: string; page?: number; derived_from: string }>;
  derived: Record<string, unknown>;
  normalized_text?: string;
  processing: ProcessamentoDocumental;
}

export async function enriquecerDocumento(
  args: {
    buffer: Buffer;
    ext: string;
    filename: string;
    pages: PaginaOuSecao[];
    extractedText: string;
    ocrUsed: boolean;
    modelId?: string;
  },
  deps?: {
    analisar?: typeof analisarDocumentoVisual;
    normalizar?: typeof normalizarParaRetrieval;
    derivado?: typeof gerarConhecimentoDerivado;
    renderizar?: typeof renderizarPaginasPdf;
  },
): Promise<Enriquecimento> {
  const analisar = deps?.analisar ?? analisarDocumentoVisual;
  const normalizar = deps?.normalizar ?? normalizarParaRetrieval;
  const derivadoFn = deps?.derivado ?? gerarConhecimentoDerivado;
  const renderizar = deps?.renderizar ?? renderizarPaginasPdf;
  const pages = args.pages.map((p) => ({ ...p }));
  const visual_pages: PaginaVisual[] = [];
  const derived_chunks: Enriquecimento["derived_chunks"] = [];
  let pagesVision = 0;
  let visionStatus: ProcessamentoDocumental["vision_status"] = "skipped";

  if (ehExtensaoImagem(args.ext)) {
    const analise = await analisar({
      image: args.buffer,
      mime: mimeDaImagem(args.ext),
      modelId: args.modelId,
    });
    if (analise.realizada && analise.descricao_factual) {
      pagesVision = 1;
      visionStatus = "done";
      const bloco = blocoVisual(analise);
      pages[0] = { secao: args.filename, texto: bloco };
      visual_pages.push({
        pagina: 1,
        descricao: analise.descricao_factual,
        tipo: analise.tipo,
        texto_visivel: analise.texto_visivel ?? [],
        model: analise.model,
      });
      derived_chunks.push({
        content: bloco,
        page: undefined,
        derived_from: "visual_image",
      });
    } else {
      visionStatus = "unavailable";
    }
  } else if (args.ext === "pdf") {
    const candidatas = paginasQuePedemVision(
      pages.map((p, i) => ({
        pagina: typeof p.pagina === "number" ? p.pagina : i + 1,
        texto: p.texto,
        temImagem: p.texto.trim().length < 80,
      })),
    );
    if (candidatas.length > 0) {
      try {
        const renders = await renderizar(args.buffer, args.pages.length || 1);
        const porPagina = new Map(renders.map((r) => [r.pagina, r.png]));
        let ok = 0;
        let falha = 0;
        for (const d of candidatas) {
          const png = porPagina.get(d.pagina);
          if (!png) continue;
          const analise = await analisar({
            image: png,
            mime: "image/png",
            modelId: args.modelId,
          });
          if (!analise.realizada || !analise.descricao_factual) {
            falha += 1;
            continue;
          }
          ok += 1;
          pagesVision += 1;
          const bloco = blocoVisual(analise);
          const idx = pages.findIndex((p) => p.pagina === d.pagina);
          if (idx >= 0) {
            const original = pages[idx]!.texto.trim();
            pages[idx] = {
              ...pages[idx]!,
              texto: original ? `${original}\n\n${bloco}` : bloco,
            };
          }
          visual_pages.push({
            pagina: d.pagina,
            descricao: analise.descricao_factual,
            tipo: analise.tipo,
            texto_visivel: analise.texto_visivel ?? [],
            model: analise.model,
          });
          derived_chunks.push({
            content: bloco,
            page: d.pagina,
            derived_from: "visual_page",
          });
        }
        visionStatus = ok === 0 ? "unavailable" : falha > 0 ? "partial" : "done";
      } catch {
        visionStatus = "unavailable";
      }
    }
  }

  const textoBase = [args.extractedText, ...visual_pages.map((v) => v.descricao)]
    .filter((t) => t.trim().length > 0)
    .join("\n\n");

  const norm = await normalizar(textoBase);
  if (norm.realizada && norm.texto !== textoBase) {
    derived_chunks.push({ content: norm.texto, derived_from: "normalization" });
  }

  const derivado = await derivadoFn(textoBase || norm.texto);
  for (const c of chunksDoDerivado(derivado)) {
    derived_chunks.push({ content: c, derived_from: "structured" });
  }

  const extractedText =
    textoBase.trim().length > 0 ? textoBase : args.extractedText;

  let extractStatus = "ready";
  if (ehExtensaoImagem(args.ext) && visionStatus === "unavailable") {
    extractStatus = "vision_unavailable";
  } else if (pagesVision > 0) {
    extractStatus = "ready";
  }

  return {
    pages,
    extractedText,
    visual_pages,
    derived_chunks,
    derived: { ...derivado },
    normalized_text: norm.realizada ? norm.texto : undefined,
    processing: {
      pages_total: Math.max(pages.length, args.pages.length, 1),
      pages_text: pages.filter((p) => p.texto.trim().length > 0).length,
      pages_ocr: args.ocrUsed ? pages.length : 0,
      pages_vision: pagesVision,
      vision_status: visionStatus,
      extract_status: extractStatus,
    },
  };
}

function blocoVisual(a: AnaliseVisual): string {
  const visivel = (a.texto_visivel ?? []).join(" · ");
  const els = (a.elementos ?? []).join("; ");
  return [
    "Conteúdo visual interpretado:",
    a.descricao_factual,
    visivel ? `Texto visível: ${visivel}` : "",
    els ? `Elementos: ${els}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function mimeDaImagem(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}
