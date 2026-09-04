/**
 * Quando a reconexão deve DESCARTAR a credencial pareada (logout no
 * transporte) antes de subir de novo.
 *
 * O modo suave (stop + start) reaproveita o que está em disco. Isso é o
 * certo depois de um restart do container: o número volta sem QR. Em
 * FAILED a credencial já foi recusada pelo WhatsApp — o start suave
 * tenta de novo, toma Connection Failure e permanece FAILED, sem nunca
 * passar por SCAN_QR_CODE. É o buraco em que a tela fica esperando um
 * QR que não vem. Logout + start recomeça o pareamento.
 *
 * O watchdog NÃO usa esta regra: religar FAILED sozinho pode ser
 * banimento. Aqui quem clica é humano.
 */
export function deveDescartarCredencial(
  status: string | null | undefined,
  force: boolean,
): boolean {
  if (force) return true;
  return (status ?? "").toUpperCase() === "FAILED";
}
