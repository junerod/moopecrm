/**
 * Normalização do jeito que `person.upserted` já manda.
 * Uma função só — lookup, evento e ficha não podem divergir.
 */

/** E.164 com `+`. O CHECK `contacts_phone_e164_format` recusa o resto. */
export function telefoneE164(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpo = valor.trim();
  if (/^\+\d{8,15}$/.test(limpo)) return limpo;
  const soDigitos = limpo.replace(/\D/g, "");
  if (soDigitos.length >= 8 && soDigitos.length <= 15) return `+${soDigitos}`;
  return undefined;
}

/** CPF (11) ou CNPJ (14), só dígitos. Sem isso o lookup chuta. */
export function cpfOuCnpjDigitos(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const so = valor.replace(/\D/g, "");
  if (so.length === 11 || so.length === 14) return so;
  return undefined;
}
