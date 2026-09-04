/**
 * Datas da ficha do tenant, no fuso que o operador lê.
 *
 * O defeito visível era a data numérica (`31/08/2026`) — o mês some na
 * leitura rápida, e a tela jurava "30d" onde o operador queria o mês
 * corrente. Uma função só, pt-BR, Brasília.
 */

const FUSO = "America/Sao_Paulo";

export function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function nomeDoMesCorrente(agora = new Date()): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    month: "long",
  }).format(agora);
}

/** Primeiro instante do mês corrente em UTC — a mesma janela de `fn_gasto_de_ia_do_mes`. */
export function inicioDoMesUtc(agora = new Date()): string {
  return new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1),
  ).toISOString();
}
