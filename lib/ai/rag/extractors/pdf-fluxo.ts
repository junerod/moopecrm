/**
 * Segunda estratégia de extração — NÃO é pdfjs.
 *
 * Percorre streams do PDF, infla /FlateDecode e coleta literais de
 * Tj / TJ / ' / ". É um parser de operadores, não uma engine de layout.
 *
 * Escolha documentada: a issue #238 já provou que `pdf-parse` NÃO é
 * uma segunda engine — é o mesmo pdf.js de 2018. Esta rota lê o arquivo
 * de outro jeito e só entra quando o pdfjs devolve pouco ou nenhum texto.
 */

import { inflateRawSync, inflateSync } from "node:zlib";

import type { PaginaOuSecao } from "@/lib/ai/rag/extractors/contrato";

function decodificarLiteral(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{1,3})/g, (_, oct: string) =>
      String.fromCharCode(parseInt(oct, 8) & 0xff),
    );
}

function textoDosOperadores(conteudo: string): string {
  const partes: string[] = [];
  const tj = /\((?:\\.|[^\\)])*\)\s*T[jJ']/g;
  let m: RegExpExecArray | null;
  while ((m = tj.exec(conteudo))) {
    const abre = m[0].indexOf("(");
    const fecha = m[0].lastIndexOf(")");
    if (abre >= 0 && fecha > abre) {
      const t = decodificarLiteral(m[0].slice(abre + 1, fecha)).trim();
      if (t.length > 0) partes.push(t);
    }
  }
  const tjArray = /\[(.*?)\]\s*TJ/gs;
  while ((m = tjArray.exec(conteudo))) {
    const interno = m[1] ?? "";
    const lits = interno.matchAll(/\((?:\\.|[^\\)])*\)/g);
    for (const lit of lits) {
      const t = decodificarLiteral(lit[0].slice(1, -1)).trim();
      if (t.length > 0) partes.push(t);
    }
  }
  return partes.join(" ").replace(/[ \t]+\n/g, "\n").trim();
}

function inflar(payload: Buffer): string | null {
  try {
    return inflateSync(payload).toString("latin1");
  } catch {
    try {
      return inflateRawSync(payload).toString("latin1");
    } catch {
      return null;
    }
  }
}

/**
 * Extrai texto cru dos content streams. Não devolve páginas reais —
 * o PDF sem xref parseado não nos dá o mapa página↔stream com segurança.
 * Quem chama trata o bloco como uma página única se for o único texto.
 */
export function extrairPdfPorFluxo(buffer: Buffer): {
  texto: string;
  paginas: PaginaOuSecao[];
} {
  const latin = buffer.toString("latin1");
  const blocos: string[] = [];
  const re = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(latin)) && i < 400) {
    i += 1;
    const raw = Buffer.from(m[1] ?? "", "latin1");
    const antes = latin.slice(Math.max(0, m.index - 200), m.index);
    const flate = /\/FlateDecode/.test(antes);
    const corpo = flate ? inflar(raw) : raw.toString("latin1");
    if (!corpo) continue;
    const t = textoDosOperadores(corpo);
    if (t.length > 0) blocos.push(t);
  }

  const texto = blocos.join("\n\n").trim();
  const paginas = texto
    ? blocos.map((t, idx) => ({ pagina: idx + 1, texto: t }))
    : [];
  return { texto, paginas };
}
