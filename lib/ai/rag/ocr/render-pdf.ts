/**
 * Render de página PDF → PNG. Só corre quando OCR_PROVIDER ≠ none.
 */

export async function renderizarPaginasPdf(
  buffer: Buffer,
  pageCount: number,
): Promise<Array<{ pagina: number; png: Buffer }>> {
  const pdfjsLib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as typeof import("pdfjs-dist");
  const { createCanvas } = await import("@napi-rs/canvas");
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const out: Array<{ pagina: number; png: Buffer }> = [];
  const teto = Math.min(pageCount, 10, pdf.numPages);
  for (let n = 1; n <= teto; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const ctx = canvas.getContext("2d");
    await page.render({
      canvas: canvas as never,
      canvasContext: ctx as never,
      viewport,
    }).promise;
    out.push({ pagina: n, png: canvas.toBuffer("image/png") });
  }
  return out;
}
