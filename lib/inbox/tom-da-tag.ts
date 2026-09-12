import { TONS_DS, type TomDs } from "@/lib/design-system/tones";
import type { PapelDoContato, SeloDaPessoa } from "@/lib/crm/papel-e-temperatura";

export type AbaDoInbox = "unassigned" | "mine" | "all" | "closed" | "ai";

/**
 * Cor estável por nome de tag. Mesma palavra = mesmo tom em qualquer conversa,
 * sem coluna de cor no banco e sem o atendente escolher paleta a cada vez.
 */
export function tomDaTag(tag: string): TomDs {
  const s = tag.trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return TONS_DS[h % TONS_DS.length]!;
}

/** Papel da pessoa — cor com significado, não enfeite. */
export const TOM_DO_PAPEL: Record<PapelDoContato, TomDs> = {
  equipe: "indigo",
  lead: "blue",
  cliente: "green",
  ignorado: "amber",
};

export function tomDoSelo(
  kind: SeloDaPessoa["kind"],
  temperatura?: string | null,
): TomDs {
  if (kind === "equipe") return "indigo";
  if (kind === "ignorado") return "amber";
  if (kind === "nao_salvo") return "red";
  if (kind === "cliente") return "green";
  if (temperatura === "quente") return "red";
  if (temperatura === "morno") return "amber";
  if (temperatura === "frio") return "cyan";
  return "blue";
}

/** Abas da lista — cada visão tem um tom para o olho achar sem ler. */
export const TOM_DA_ABA: Record<AbaDoInbox, TomDs> = {
  unassigned: "amber",
  mine: "blue",
  all: "teal",
  closed: "indigo",
  ai: "violet",
};
