export type OcrProviderNome = "none" | "tesseract" | "vision";

export interface PedidoOcr {
  imagens: Array<{ pagina: number; png: Buffer }>;
}

export interface ResultadoOcr {
  paginas: Array<{ pagina: number; texto: string }>;
  provider: OcrProviderNome;
}

export interface OcrProvider {
  nome: OcrProviderNome;
  disponivel(): boolean;
  reconhecer(pedido: PedidoOcr): Promise<ResultadoOcr>;
}
