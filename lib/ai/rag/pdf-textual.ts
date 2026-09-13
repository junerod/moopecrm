/**
 * PDF 1.4 textual mínimo no MESMO formato das fixtures de
 * `tests/fixtures/sample-text.pdf` — pdfjs-dist extrai isto de forma estável.
 */
export function montarPdfTextual(linhas: string[]): Buffer {
  const texto = linhas.join(" ").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const streamBody = `BT /F1 12 Tf 72 700 Td (${texto}) Tj ET\n`;
  const streamLen = Buffer.byteLength(streamBody);

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamBody}endstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  const header = "%PDF-1.4\n";
  let cursor = Buffer.byteLength(header);
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(cursor);
    cursor += Buffer.byteLength(obj);
  }

  const xref =
    `xref\n0 6\n` +
    `0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("");

  const body = objects.join("");
  const startxref = Buffer.byteLength(header) + Buffer.byteLength(body);
  return Buffer.from(
    `${header}${body}${xref}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`,
  );
}
