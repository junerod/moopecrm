/**
 * Gera fixtures documentais REAIS — não usa montarPdfTextual.
 * PDF: stream FlateDecode (zlib). DOCX: zip OOXML via fflate.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { zipSync } from "fflate";

const aqui = dirname(fileURLToPath(import.meta.url));

function pdfComFlate(linhas: string[]): Buffer {
  const texto = linhas.join("\n");
  const streamSrc = `BT /F1 12 Tf 50 720 Td (${texto.replace(/[()\\]/g, "\\$&")}) Tj ET\n`;
  const compressed = deflateSync(Buffer.from(streamSrc, "latin1"));
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${compressed.length} /Filter /FlateDecode >> stream\n`,
  ];
  const mid = Buffer.concat([
    Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"),
    Buffer.from(objects[0]!),
    Buffer.from(objects[1]!),
    Buffer.from(objects[2]!),
    Buffer.from(objects[3]!),
    compressed,
    Buffer.from("\nendstream\nendobj\n"),
    Buffer.from("5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n"),
  ]);
  const xrefPos = mid.length;
  const xref = `xref\n0 6\n0000000000 65535 f \n0000000015 00000 n \n0000000064 00000 n \n0000000123 00000 n \n0000000278 00000 n \n0000000000 00000 n \n`;
  const trailer = `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.concat([mid, Buffer.from(xref), Buffer.from(trailer)]);
}

function pdfMultipage(p1: string, p2: string): Buffer {
  const mk = (t: string) => {
    const src = `BT /F1 12 Tf 50 720 Td (${t.replace(/[()\\]/g, "\\$&")}) Tj ET\n`;
    return deflateSync(Buffer.from(src, "latin1"));
  };
  const c1 = mk(p1);
  const c2 = mk(p2);
  const parts = [
    "%PDF-1.4\n",
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj\n",
    "4 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >> endobj\n",
    `5 0 obj << /Length ${c1.length} /Filter /FlateDecode >> stream\n`,
  ];
  const a = Buffer.concat([
    Buffer.from(parts.join("")),
    c1,
    Buffer.from(`\nendstream\nendobj\n6 0 obj << /Length ${c2.length} /Filter /FlateDecode >> stream\n`),
    c2,
    Buffer.from(
      "\nendstream\nendobj\n7 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Courier >> endobj\n",
    ),
  ]);
  return Buffer.concat([
    a,
    Buffer.from(`xref\n0 8\ntrailer << /Size 8 /Root 1 0 R >>\nstartxref\n${a.length}\n%%EOF\n`),
  ]);
}

function pdfProtegido(): Buffer {
  return Buffer.from(
    `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
4 0 obj << /Filter /Standard /V 1 /R 2 /O (xxxxxxxxxxxxxxxx) /U (xxxxxxxxxxxxxxxx) /P -4 >> endobj
trailer << /Size 5 /Root 1 0 R /Encrypt 4 0 R >>
startxref
0
%%EOF
`,
    "latin1",
  );
}

function docxSimples(paragrafos: string[], heading?: string, tabela?: string[][]): Buffer {
  const runs: string[] = [];
  if (heading) {
    runs.push(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escXml(heading)}</w:t></w:r></w:p>`,
    );
  }
  for (const p of paragrafos) {
    runs.push(`<w:p><w:r><w:t>${escXml(p)}</w:t></w:r></w:p>`);
  }
  if (tabela && tabela.length > 0) {
    runs.push("<w:tbl>");
    for (const row of tabela) {
      runs.push("<w:tr>");
      for (const cell of row) {
        runs.push(
          `<w:tc><w:p><w:r><w:t>${escXml(cell)}</w:t></w:r></w:p></w:tc>`,
        );
      }
      runs.push("</w:tr>");
    }
    runs.push("</w:tbl>");
  }
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${runs.join("")}</w:body>
</w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const zipped = zipSync({
    "[Content_Types].xml": Buffer.from(contentTypes),
    "_rels/.rels": Buffer.from(rels),
    "word/document.xml": Buffer.from(document),
  });
  return Buffer.from(zipped);
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

mkdirSync(aqui, { recursive: true });

writeFileSync(
  join(aqui, "pdf-real-plataforma.pdf"),
  pdfComFlate([
    "Produto: Plataforma Elevatoria TESTE PDF REAL  Preco: R$ 742,30  Codigo: PDFREAL-8127",
  ]),
);

writeFileSync(
  join(aqui, "pdf-multipage.pdf"),
  pdfMultipage(
    "Pagina 1 — catalogo MOOPE. Plataforma Elevatoria TESTE PDF REAL.",
    "Pagina 2 — Preco R$ 742,30 codigo PDFREAL-8127.",
  ),
);

writeFileSync(
  join(aqui, "pdf-layout-courier.pdf"),
  pdfComFlate(["Fonte Courier e layout diferente. Codigo PDFREAL-8127 ainda precisa aparecer."]),
);

writeFileSync(join(aqui, "pdf-protegido.pdf"), pdfProtegido());

const semTexto = join(aqui, "..", "sample-sem-texto.pdf");
if (existsSync(semTexto)) {
  copyFileSync(semTexto, join(aqui, "pdf-escaneado.pdf"));
}

writeFileSync(
  join(aqui, "docx-compressor.docx"),
  docxSimples(
    [
      "Produto: Compressor Atlas TESTE DOCX",
      "Preco: R$ 918,40",
      "Codigo: DOCX-5512",
    ],
    "Locacoes",
    [
      ["Item", "Valor"],
      ["Compressor Atlas TESTE DOCX", "R$ 918,40"],
    ],
  ),
);

writeFileSync(
  join(aqui, "docx-paragrafos.docx"),
  docxSimples(["Primeiro paragrafo do DOCX de teste.", "Segundo paragrafo com codigo DOCX-5512."]),
);

writeFileSync(
  join(aqui, "regras.txt"),
  "Garantias\n\nToda locacao cobre 24 horas de suporte. Codigo TXT-4401.\n",
);

writeFileSync(
  join(aqui, "garantias.md"),
  "# Garantias\n\nA cobertura padrao e de 24 horas. Codigo MD-2208.\n",
);

console.log("fixtures knowledge gravadas em", aqui);
