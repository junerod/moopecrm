/**
 * Casa a resposta do contato com uma opção de Menu ou item de FAQ.
 * Sem LLM: número, palavra-número (um/dois) ou palavra-chave.
 */

const NUMERO_POR_EXTENSO: Record<string, number> = {
  um: 1,
  uma: 1,
  primeiro: 1,
  primeira: 1,
  dois: 2,
  duas: 2,
  segundo: 2,
  segunda: 2,
  tres: 3,
  três: 3,
  terceiro: 3,
  terceira: 3,
  quatro: 4,
  quarto: 4,
  quarta: 4,
  cinco: 5,
  quinto: 5,
  quinta: 5,
  seis: 6,
  sexto: 6,
  sexta: 6,
  sete: 7,
  setimo: 7,
  sétimo: 7,
  oito: 8,
  oitavo: 8,
  nove: 9,
  nono: 9,
};

export function normalizarResposta(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface OpcaoDeMenu {
  id: string;
  numero: number;
  label: string;
  keywords: string[];
}

export interface ItemDeFaq {
  id: string;
  keywords: string[];
}

function tokens(texto: string): string[] {
  const n = normalizarResposta(texto);
  return n.length === 0 ? [] : n.split(" ");
}

function casarNumero(normalizado: string): number | null {
  if (/^\d{1,2}$/.test(normalizado)) return Number(normalizado);
  const extenso = NUMERO_POR_EXTENSO[normalizado];
  return extenso ?? null;
}

/**
 * Casa a mensagem com uma opção. Ordem: número isolado → palavra-número →
 * palavra-chave / rótulo. Sem match devolve null (o motor pergunta de novo).
 */
export function casarOpcaoDoMenu(texto: string, opcoes: OpcaoDeMenu[]): string | null {
  const n = normalizarResposta(texto);
  if (n.length === 0) return null;

  const porNumero = casarNumero(n);
  if (porNumero !== null) {
    const hit = opcoes.find((o) => o.numero === porNumero);
    if (hit) return hit.id;
  }

  const toks = tokens(texto);
  for (const tok of toks) {
    const num = casarNumero(tok);
    if (num === null) continue;
    const hit = opcoes.find((o) => o.numero === num);
    if (hit) return hit.id;
  }

  for (const opcao of opcoes) {
    const chaves = [opcao.label, ...opcao.keywords].map(normalizarResposta).filter(Boolean);
    if (chaves.some((chave) => n === chave || n.includes(chave) || toks.includes(chave))) {
      return opcao.id;
    }
  }
  return null;
}

export function casarItemDeFaq(texto: string, itens: ItemDeFaq[]): string | null {
  const n = normalizarResposta(texto);
  if (n.length === 0) return null;
  const toks = tokens(texto);
  for (const item of itens) {
    const chaves = item.keywords.map(normalizarResposta).filter(Boolean);
    if (chaves.some((chave) => n === chave || n.includes(chave) || toks.includes(chave))) {
      return item.id;
    }
  }
  return null;
}

export function textoDoMenu(titulo: string, opcoes: OpcaoDeMenu[]): string {
  const linhas = opcoes.map((o) => `${o.numero} ${o.label}`);
  const corpo = linhas.join("\n");
  return titulo.trim().length > 0 ? `${titulo.trim()}\n${corpo}` : corpo;
}
