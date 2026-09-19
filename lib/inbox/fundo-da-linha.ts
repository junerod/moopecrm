/**
 * Fundo da linha e da barra do inbox pelo PAPEL da pessoa.
 * Zebra só entra quando ainda não há papel — senão Cliente e Lead
 * ficam iguais e o olho não acha.
 */

import { ehPapelDoContato, type PapelDoContato } from "@/lib/crm/papel-e-temperatura";

export const FUNDO_DA_LINHA: Record<PapelDoContato, string> = {
  cliente: "bg-[var(--inbox-row-cliente)]",
  lead: "bg-[var(--inbox-row-lead)]",
  equipe: "bg-[var(--inbox-row-equipe)]",
  ignorado: "bg-[var(--inbox-row-ignorado)]",
};

export function classeFundoDaLinha(opts: {
  papel?: string | null;
  selecionada: boolean;
  zebraImpar?: boolean;
}): string {
  if (opts.selecionada) return "bg-[var(--moope-primary-bg)]";
  if (ehPapelDoContato(opts.papel)) return FUNDO_DA_LINHA[opts.papel];
  return opts.zebraImpar ? "bg-[var(--inbox-row-alt)]" : "";
}

export function classeFundoDoHeader(papel?: string | null): string {
  if (ehPapelDoContato(papel)) return FUNDO_DA_LINHA[papel];
  return "bg-[var(--color-surface)]";
}
