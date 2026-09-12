import { PROACTIVE_THROTTLE_MS } from "@/lib/agent-engine/pacing/defaults";

/** Campanha usa o piso proativo (5s), não o conversacional de 1,2s. */
export const PACING_CAMPANHA_MS = PROACTIVE_THROTTLE_MS;

export function podeEnviarAgora(input: {
  lastSentAt: string | null | undefined;
  agora: Date;
  pacingMs?: number;
}): boolean {
  if (!input.lastSentAt) return true;
  const ultimo = new Date(input.lastSentAt);
  if (Number.isNaN(ultimo.getTime())) return true;
  const piso = input.pacingMs ?? PACING_CAMPANHA_MS;
  return input.agora.getTime() - ultimo.getTime() >= piso;
}

export function msAteProximo(input: {
  lastSentAt: string | null | undefined;
  agora: Date;
  pacingMs?: number;
}): number {
  if (podeEnviarAgora(input)) return 0;
  const ultimo = new Date(input.lastSentAt!);
  const piso = input.pacingMs ?? PACING_CAMPANHA_MS;
  return Math.max(0, piso - (input.agora.getTime() - ultimo.getTime()));
}
