import { env } from "@/lib/env";

import type { OcrProvider, OcrProviderNome, PedidoOcr, ResultadoOcr } from "@/lib/ai/rag/ocr/tipos";

function nomeDoProvider(): OcrProviderNome {
  const raw = String(env.OCR_PROVIDER ?? "none").trim().toLowerCase();
  if (raw === "tesseract") return "tesseract";
  if (raw === "vision") return "vision";
  return "none";
}

const nenhum: OcrProvider = {
  nome: "none",
  disponivel: () => false,
  async reconhecer(): Promise<ResultadoOcr> {
    return { paginas: [], provider: "none" };
  },
};

async function tesseractProvider(): Promise<OcrProvider> {
  return {
    nome: "tesseract",
    disponivel: () => true,
    async reconhecer(pedido: PedidoOcr): Promise<ResultadoOcr> {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("por+eng");
      try {
        const paginas: Array<{ pagina: number; texto: string }> = [];
        for (const img of pedido.imagens.slice(0, 10)) {
          const r = await worker.recognize(img.png);
          const texto = String(r.data.text ?? "").trim();
          if (texto) paginas.push({ pagina: img.pagina, texto });
        }
        return { paginas, provider: "tesseract" };
      } finally {
        await worker.terminate();
      }
    },
  };
}

export function ocrConfigurado(): boolean {
  return nomeDoProvider() !== "none";
}

export function ocrProviderNome(): OcrProviderNome {
  return nomeDoProvider();
}

export async function resolverOcr(): Promise<OcrProvider> {
  const nome = nomeDoProvider();
  if (nome === "tesseract") return tesseractProvider();
  return nenhum;
}
