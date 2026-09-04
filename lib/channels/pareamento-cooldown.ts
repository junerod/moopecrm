/**
 * Depois que o número cai (FAILED) ou pede QR, o WhatsApp pune parear de novo
 * na hora. O app costuma falar "daqui a 6 horas". Cada QR novo estica a pena.
 *
 * STOPPED não entra: é container que parou com a credencial intacta — religar
 * suave não é pareamento.
 */

/** Prazo que o WhatsApp costuma impor depois de logout / QR em sequência. */
export const ESPERA_APOS_QUEDA_MS = 6 * 60 * 60 * 1000;

export type EsperaDePareamento = {
  esperar: boolean;
  waitSeconds: number;
  until: Date | null;
};

export function esperaAposQueda(
  status: string | null | undefined,
  lastStatusChangeAt: string | Date | null | undefined,
  agora: Date = new Date(),
): EsperaDePareamento {
  const st = String(status ?? "").toUpperCase();
  if (st !== "FAILED" && st !== "SCAN_QR_CODE") {
    return { esperar: false, waitSeconds: 0, until: null };
  }
  if (lastStatusChangeAt == null) return { esperar: false, waitSeconds: 0, until: null };
  const t = lastStatusChangeAt instanceof Date ? lastStatusChangeAt : new Date(lastStatusChangeAt);
  if (Number.isNaN(t.getTime())) return { esperar: false, waitSeconds: 0, until: null };
  const until = new Date(t.getTime() + ESPERA_APOS_QUEDA_MS);
  const waitMs = until.getTime() - agora.getTime();
  if (waitMs <= 0) return { esperar: false, waitSeconds: 0, until: null };
  return { esperar: true, waitSeconds: Math.ceil(waitMs / 1000), until };
}

export function fraseEsperaPareamento(until: Date, timezone = "America/Sao_Paulo"): string {
  const hora = until.toLocaleString("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    `O WhatsApp pediu espera depois da queda. Escanear o QR agora piora e pode travar por mais horas. ` +
    `Tente de novo depois das ${hora}.`
  );
}
