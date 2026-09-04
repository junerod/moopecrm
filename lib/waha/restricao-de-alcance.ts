/**
 * O WhatsApp barra o aparelho pareado de iniciar conversa com número novo.
 * HTTP 463 / tctoken / RESTRICT_ALL_COMPANIONS — a sessão continua de pé.
 * Tratar isso como "desconectou" manda a pessoa no QR, e o QR piora.
 */

export const MENSAGEM_RESTRICAO_DE_ALCANCE =
  "O WhatsApp bloqueou o primeiro contato pelo aparelho pareado. Espere. Não reconecte o QR — isso piora e pode travar por horas.";

/** Segundos que a locadora deve esperar antes de insistir neste envio. */
export const ESPERA_RESTRICAO_DE_ALCANCE_S = 6 * 60 * 60;

export function ehRestricaoDeAlcance(erro: unknown): boolean {
  const texto = erro instanceof Error ? erro.message : String(erro ?? "");
  return /463|tctoken|account restricted|restrict_all_companions|reachout\s*time\s*lock|reachouttimelock/i.test(
    texto,
  );
}
