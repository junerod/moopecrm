/**
 * A hora em que a conexão caiu — para puxar o que o aparelho recebeu
 * enquanto o CRM estava surdo.
 *
 * Vive em `channel_sessions.metadata.caiu_em`. Sem coluna nova: a queda
 * é episódio, não campo permanente. A primeira queda do episódio fica;
 * a volta apaga depois de puxar o recorte.
 */

export const CHAVE_CAIU_EM = "caiu_em";

/** Teto: queda de uma semana atrás ainda puxa; 2019 não. */
export const JANELA_DESDE_A_QUEDA_MS = 7 * 24 * 60 * 60 * 1000;

export function lerCaiuEm(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>)[CHAVE_CAIU_EM];
  if (typeof raw !== "string") return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

/** Só grava a PRIMEIRA queda do episódio. */
export function comCaiuEmSeFaltar(
  metadata: unknown,
  quandoIso: string,
): Record<string, unknown> | null {
  if (lerCaiuEm(metadata) != null) return null;
  const base =
    metadata && typeof metadata === "object"
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  return { ...base, [CHAVE_CAIU_EM]: quandoIso };
}

export function semCaiuEm(metadata: Record<string, unknown>): Record<string, unknown> {
  const next = { ...metadata };
  delete next[CHAVE_CAIU_EM];
  return next;
}
