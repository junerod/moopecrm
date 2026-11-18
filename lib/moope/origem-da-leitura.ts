/**
 * De onde o atendimento lê a locadora.
 *
 * A mesma conta vale na chamada (GET /api/crm/…) e na tela de conferência.
 * URL da API, se a locadora mandou. Senão, o domínio do webhook. Sem os dois,
 * não há de onde ler.
 */
export function enderecoDeLeitura(conn: {
  partner_api_url?: string | null;
  partner_webhook_url?: string | null;
}): { base: string | null; veioDe: "api" | "webhook" | "nenhum" } {
  const explicita = conn.partner_api_url?.trim();
  if (explicita) return { base: explicita.replace(/\/+$/, ""), veioDe: "api" };
  const webhook = conn.partner_webhook_url?.trim();
  if (!webhook) return { base: null, veioDe: "nenhum" };
  try {
    return { base: new URL(webhook).origin, veioDe: "webhook" };
  } catch {
    return { base: null, veioDe: "nenhum" };
  }
}
