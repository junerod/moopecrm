/**
 * Número reconectado: a conversa antiga aponta para a sessão STOPPED,
 * a WORKING nova tem o mesmo telefone. Enviar pela morta deixa a mensagem
 * na fila para sempre — o atendente acha que mandou.
 */
import { digitosDoTelefone } from "@/lib/channels/sessoes-residuais";

export interface SessaoParaEnvio {
  id: string;
  status: string | null;
  phone_number?: string | null;
  archived_at?: string | null;
}

export function sessaoEstaProntaParaEnvio(sessao: SessaoParaEnvio | null | undefined): boolean {
  if (!sessao || sessao.archived_at) return false;
  return (sessao.status ?? "").toUpperCase() === "WORKING";
}

export function sessaoAindaPodeVoltar(status: string | null | undefined): boolean {
  const s = (status ?? "").toUpperCase();
  return s === "SCAN_QR_CODE" || s === "STARTING" || s === "PAIRING";
}

/** Irmã WORKING do mesmo número — ou a própria, se já estiver viva. */
export function escolherSessaoVivaParaEnvio(
  atual: SessaoParaEnvio | null | undefined,
  irmas: SessaoParaEnvio[],
): SessaoParaEnvio | null {
  if (sessaoEstaProntaParaEnvio(atual)) return atual ?? null;
  const fone = digitosDoTelefone(atual?.phone_number);
  if (!fone) return null;
  return (
    irmas.find(
      (s) =>
        s.id !== atual?.id &&
        sessaoEstaProntaParaEnvio(s) &&
        digitosDoTelefone(s.phone_number) === fone,
    ) ?? null
  );
}

/** Sessões caídas do mesmo número — o histórico antigo mora aqui. */
export function sessoesSupersedidasDoNumero(
  viva: SessaoParaEnvio | null | undefined,
  irmas: SessaoParaEnvio[],
): string[] {
  const fone = digitosDoTelefone(viva?.phone_number);
  if (!fone || !sessaoEstaProntaParaEnvio(viva)) return [];
  return irmas
    .filter(
      (s) =>
        s.id !== viva?.id &&
        !sessaoEstaProntaParaEnvio(s) &&
        digitosDoTelefone(s.phone_number) === fone,
    )
    .map((s) => s.id);
}
