import type { TomDs } from "@/lib/design-system/tones";

/** Paleta pastel por índice — não persiste no banco. */
export const TOMS_ETAPA: readonly TomDs[] = ["blue", "cyan", "violet", "indigo", "amber"];

export function tomDaEtapa(
  stage: { is_won: boolean; is_lost: boolean },
  index: number,
): TomDs {
  if (stage.is_won) return "green";
  if (stage.is_lost) return "red";
  return TOMS_ETAPA[index % TOMS_ETAPA.length]!;
}

export function tomDaTemperatura(temp: string | null | undefined): TomDs | null {
  if (temp === "quente") return "red";
  if (temp === "morno") return "amber";
  if (temp === "frio") return "cyan";
  return null;
}
