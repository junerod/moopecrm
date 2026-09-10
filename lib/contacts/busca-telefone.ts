/**
 * Trechos numéricos para achar um telefone gravado em E.164
 * quando o comercial busca o número como digitou: (48) 99991-2026.
 */
export function trechosDeTelefoneParaBusca(q: string): string[] {
  const digits = q.replace(/\D/g, "");
  if (digits.length < 8) return [];
  const out = new Set<string>([digits]);
  out.add(digits.slice(-8));
  if (digits.length >= 9) out.add(digits.slice(-9));
  return [...out];
}
