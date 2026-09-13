import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Token só nos pixels da página — pdfjs não extrai isto como texto. */
export const TOKEN_VISUAL_PDF = "TELA-VISION-8821";

export function jpegTelaVision(): { jpeg: Buffer; width: number; height: number } {
  const width = 800;
  const height = 480;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#F9FAFB";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText("MOOPE · Gestão de Sinistros", 40, 80);
  ctx.font = "20px sans-serif";
  ctx.fillText("Screenshot da tela do produto", 40, 130);
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(`Código da tela: ${TOKEN_VISUAL_PDF}`, 40, 240);
  ctx.font = "18px sans-serif";
  ctx.fillText("Menu: Investidores · Sinistros · Relatórios", 40, 320);
  return { jpeg: Buffer.from(canvas.toBuffer("image/jpeg", 0.9)), width, height };
}

/** PDF 1.4 com uma página = JPEG. Sem stream de texto com o token. */
export function pdfComScreenshotVisual(): Buffer {
  const { jpeg, width, height } = jpegTelaVision();
  const header = Buffer.from("%PDF-1.4\n");
  const objects: Buffer[] = [];

  const obj = (n: number, body: string | Buffer): Buffer => {
    const start = Buffer.from(`${n} 0 obj\n`);
    const end = Buffer.from("\nendobj\n");
    return Buffer.concat([start, typeof body === "string" ? Buffer.from(body) : body, end]);
  };

  objects.push(obj(1, "<< /Type /Catalog /Pages 2 0 R >>"));
  objects.push(obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>"));
  objects.push(
    obj(
      3,
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 396] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
    ),
  );

  const imgDict = Buffer.from(
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
  );
  objects.push(obj(4, Buffer.concat([imgDict, jpeg, Buffer.from("\nendstream")])));

  const content = "q 612 0 0 396 0 0 cm /Im0 Do Q\n";
  objects.push(obj(5, `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`));

  let cursor = header.length;
  const offsets = [0];
  for (const o of objects) {
    offsets.push(cursor);
    cursor += o.length;
  }
  const xref =
    `xref\n0 6\n` +
    `0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("");
  const body = Buffer.concat(objects);
  const startxref = header.length + body.length;
  const trailer = Buffer.from(
    `${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`,
  );
  return Buffer.concat([header, body, trailer]);
}

export function gravarPdfVisual(): string {
  const dest = path.join(os.tmpdir(), "Manual-Teste.pdf");
  writeFileSync(dest, pdfComScreenshotVisual());
  return dest;
}
