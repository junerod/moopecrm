/**
 * Dois eixos que a Inbox mistura se forem um chip só.
 *
 * Papel é da PESSOA (equipe / lead / cliente). Temperatura é do NEGÓCIO
 * aberto (frio / morno / quente), escrita por gente — não é o score de IA.
 */

export const PAPEIS_DO_CONTATO = ["equipe", "lead", "cliente", "ignorado"] as const;
export type PapelDoContato = (typeof PAPEIS_DO_CONTATO)[number];

export const TEMPERATURAS_DO_LEAD = ["frio", "morno", "quente"] as const;
export type TemperaturaDoLead = (typeof TEMPERATURAS_DO_LEAD)[number];

/** Filtro da lista: comercial esconde equipe. */
export const FILTROS_DE_PAPEL = [
  "comercial",
  "equipe",
  "lead",
  "cliente",
  "ignorado",
  "todos",
] as const;
export type FiltroDePapel = (typeof FILTROS_DE_PAPEL)[number];

export const ROTULO_DO_PAPEL = {
  equipe: "Equipe",
  lead: "Lead",
  cliente: "Cliente",
  ignorado: "Ignorar",
} as const satisfies Record<PapelDoContato, string>;

export const DICA_DO_PAPEL = {
  lead: "Abre um negócio no funil. Use em quem ainda está em conversa de venda.",
  cliente: "Já é cliente. O automático não cria lead novo desta conversa.",
  equipe: "Pessoa de dentro. Some da fila comercial.",
  ignorado: "Não é venda. Some da fila e o automático não trata como lead.",
} as const satisfies Record<PapelDoContato, string>;

export const ROTULO_DA_TEMPERATURA = {
  frio: "Lead frio",
  morno: "Lead morno",
  quente: "Lead quente",
} as const satisfies Record<TemperaturaDoLead, string>;

export function ehPapelDoContato(v: unknown): v is PapelDoContato {
  return (PAPEIS_DO_CONTATO as readonly string[]).includes(v as string);
}

/** Equipe e ignorado: conversa existe, funil e nascimento automático não. */
export function papelForaDoFunil(papel: string | null | undefined): boolean {
  return papel === "equipe" || papel === "ignorado";
}

export function ehTemperaturaDoLead(v: unknown): v is TemperaturaDoLead {
  return v === "frio" || v === "morno" || v === "quente";
}

export type SeloDaPessoa =
  | { kind: "equipe"; texto: "Equipe" }
  | { kind: "ignorado"; texto: "Ignorar" }
  | { kind: "nao_salvo"; texto: "Nome do WhatsApp · não salvo" }
  | { kind: "cliente"; texto: "Cliente" }
  | { kind: "lead"; texto: string };

/**
 * O que cabe no header e na linha da lista — um selo, não o seletor.
 * Ordem: Equipe / Ignorar > não salvo > Cliente > Lead (+ temperatura se houver).
 */
export function seloDaPessoa(entrada: {
  papel?: string | null;
  naoSalvo: boolean;
  temperatura?: string | null;
}): SeloDaPessoa | null {
  if (entrada.papel === "equipe") return { kind: "equipe", texto: "Equipe" };
  if (entrada.papel === "ignorado") return { kind: "ignorado", texto: "Ignorar" };
  if (entrada.naoSalvo) {
    return { kind: "nao_salvo", texto: "Nome do WhatsApp · não salvo" };
  }
  if (entrada.papel === "cliente") return { kind: "cliente", texto: "Cliente" };
  if (entrada.papel === "lead") {
    const temp = ehTemperaturaDoLead(entrada.temperatura)
      ? ROTULO_DA_TEMPERATURA[entrada.temperatura]
      : "Lead";
    return { kind: "lead", texto: temp };
  }
  return null;
}

export function temperaturaDoLeadAberto(
  leads:
    | Array<{ status?: string | null; temperatura?: string | null }>
    | null
    | undefined,
): string | null {
  const abertos = (leads ?? []).filter((l) => l.status === "open");
  const comTemp = abertos.find((l) => ehTemperaturaDoLead(l.temperatura));
  return comTemp?.temperatura ?? abertos[0]?.temperatura ?? null;
}
