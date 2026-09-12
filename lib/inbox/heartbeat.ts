/**
 * Ping de vida do atendente — reusa `attendant_availability.last_heartbeat_at`.
 *
 * O cron `attendant-heartbeat` marca offline quem não pinga há 15 min
 * (`HEARTBEAT_TIMEOUT_MINUTES`). O client pinga com folga, só com a aba
 * visível e só enquanto o atendente está disponível.
 *
 * Intervalo: 2 minutos. 15/2 = 7 pings por janela do sweep; 1 req/2 min por
 * aba visível. Aba oculta não pinga (evita tempestade ao voltar de sleep:
 * o próximo tick visível cobre). Não é websocket novo.
 */
import { HEARTBEAT_TIMEOUT_MINUTES } from "@/lib/routing/eligibility";

/** Compatível com o sweep de 15 min — folga de ~7×. */
export const HEARTBEAT_PING_MS = 2 * 60_000;

export function devePingarHeartbeat(entrada: {
  isAvailable: boolean;
  visivel: boolean;
  agora: Date;
  ultimoPingEm: Date | null;
  intervaloMs?: number;
}): boolean {
  if (!entrada.isAvailable) return false;
  if (!entrada.visivel) return false;
  const intervalo = entrada.intervaloMs ?? HEARTBEAT_PING_MS;
  if (!entrada.ultimoPingEm) return true;
  return entrada.agora.getTime() - entrada.ultimoPingEm.getTime() >= intervalo;
}

export function statusDoAtendente(entrada: {
  isAvailable: boolean;
  lastHeartbeatAt: string | Date | null | undefined;
  agora: Date;
  timeoutMinutes?: number;
}): { chave: "disponivel" | "indisponivel" | "offline"; rotulo: string } {
  if (!entrada.isAvailable) {
    return { chave: "indisponivel", rotulo: "Indisponível" };
  }
  const ultimo = entrada.lastHeartbeatAt ? new Date(entrada.lastHeartbeatAt) : null;
  const timeout = (entrada.timeoutMinutes ?? HEARTBEAT_TIMEOUT_MINUTES) * 60_000;
  const velho =
    !ultimo ||
    Number.isNaN(ultimo.getTime()) ||
    entrada.agora.getTime() - ultimo.getTime() > timeout;
  if (velho) return { chave: "offline", rotulo: "Offline" };
  return { chave: "disponivel", rotulo: "Disponível" };
}

export function vistoHa(lastHeartbeatAt: string | Date | null | undefined, agora: Date): string | null {
  if (!lastHeartbeatAt) return null;
  const ultimo = new Date(lastHeartbeatAt);
  if (Number.isNaN(ultimo.getTime())) return null;
  const min = Math.max(0, Math.round((agora.getTime() - ultimo.getTime()) / 60_000));
  if (min < 1) return "visto agora";
  if (min === 1) return "visto há 1 min";
  return `visto há ${min} min`;
}
