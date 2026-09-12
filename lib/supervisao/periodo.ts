export type PeriodoPronto = "hoje" | "7d" | "30d";

export function janelaDoPeriodo(
  periodo: PeriodoPronto,
  agora: Date = new Date(),
): { from: Date; to: Date } {
  const to = agora;
  const from = new Date(agora.getTime());
  if (periodo === "hoje") {
    from.setHours(0, 0, 0, 0);
  } else if (periodo === "7d") {
    from.setTime(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    from.setTime(agora.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return { from, to };
}

export function ehPeriodoPronto(v: string | null | undefined): v is PeriodoPronto {
  return v === "hoje" || v === "7d" || v === "30d";
}
