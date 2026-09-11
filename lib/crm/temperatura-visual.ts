import type { TemperaturaDoLead } from "@/lib/crm/papel-e-temperatura";

/** Dot/chip só — nunca pinta o card inteiro. */
export const CLASSE_DOT_TEMPERATURA: Record<TemperaturaDoLead, string> = {
  quente: "bg-orange-500",
  morno: "bg-amber-400",
  frio: "bg-sky-500",
};

export const CLASSE_TEXTO_TEMPERATURA: Record<TemperaturaDoLead, string> = {
  quente: "text-orange-400",
  morno: "text-amber-300",
  frio: "text-sky-400",
};

export const CLASSE_ATRASADO = "text-destructive";
