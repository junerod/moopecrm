import type { Bloco, Capitulo } from "@/lib/manual/conteudo";

/** Sem acento, minúsculo — o que a pessoa digitou e o que está no texto viram a mesma chave. */
export function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function textoDoBloco(b: Bloco): string {
  switch (b.tipo) {
    case "p":
    case "aviso":
      return b.texto;
    case "passos":
    case "lista":
      return b.itens.join(" ");
    case "tabela":
      return [b.cabecalho.join(" "), ...b.linhas.map((l) => l.join(" "))].join(" ");
  }
}

export function textoDoCapitulo(c: Capitulo): string {
  return [c.titulo, c.resumo, c.palavras.join(" "), ...c.blocos.map(textoDoBloco)].join(" ");
}

export function buscarCapitulos(capitulos: readonly Capitulo[], q: string): Capitulo[] {
  const n = normalizarBusca(q.trim());
  if (!n) return [...capitulos];
  return capitulos.filter((c) => normalizarBusca(textoDoCapitulo(c)).includes(n));
}
