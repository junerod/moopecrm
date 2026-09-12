/**
 * Telefone do ATENDENTE para alerta interno — E.164.
 * Não é o telefone do cliente. Não normaliza conversa CRM.
 */

const E164 = /^\+[1-9]\d{7,14}$/;

export function normalizarE164(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  const soDigitos = entrada.replace(/\D/g, "");
  if (!soDigitos) return null;
  const temMais = entrada.trim().startsWith("+");
  // Sem "+" só aceita se já vier com DDI (55…). Número local solto não vira E.164.
  if (!temMais && !soDigitos.startsWith("55")) return null;
  const comMais = `+${soDigitos}`;
  if (!E164.test(comMais)) return null;
  return comMais;
}

export function ehE164(entrada: string | null | undefined): boolean {
  return normalizarE164(entrada) !== null;
}
