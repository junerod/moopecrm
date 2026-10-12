/**
 * "ligar alerta lead" / "desligar alerta lead" no WhatsApp do Assessor.
 * Desligar só para o aviso. Não tira a pessoa do Assessor.
 */

export type LadoDoAlerta = "on" | "off";

export function fraseAlertaLead(text: string): LadoDoAlerta | null {
  const t = String(text || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!t || t.length > 40) return null;
  if (/^(ligar|liga|ativar|ativa)\s+alerta\s+leads?$/.test(t)) return "on";
  if (/^(desligar|desliga|desativar|desativa)\s+alerta\s+leads?$/.test(t)) return "off";
  return null;
}

function nucleo(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length === 11 && d[2] === "9") d = d.slice(0, 2) + d.slice(3);
  return d;
}

/** Compara DDD+número, com ou sem o 55 e com ou sem o nono dígito. */
export function mesmoTelefone(a: string, b: string): boolean {
  const na = nucleo(a);
  const nb = nucleo(b);
  return na.length >= 10 && na === nb;
}
