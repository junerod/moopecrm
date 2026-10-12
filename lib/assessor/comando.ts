/**
 * "ligar alerta lead" / "desligar alerta lead" no WhatsApp do Assessor.
 * Desligar só para o aviso. Não tira a pessoa do Assessor.
 */

export type LadoDoAlerta = "on" | "off";
export type KindDoAlerta = "lead" | "resposta";

export function normalizarFrase(text: string): string {
  return String(text || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function fraseAlertaLead(text: string): { kind: KindDoAlerta; lado: LadoDoAlerta } | null {
  const t = normalizarFrase(text);
  if (!t || t.length > 48) return null;
  const liga = /^(ligar|liga|ativar|ativa)\s+/;
  const desliga = /^(desligar|desliga|desativar|desativa)\s+/;
  if (/^(ligar|liga|ativar|ativa)\s+alerta\s+respostas?$/.test(t)) return { kind: "resposta", lado: "on" };
  if (/^(desligar|desliga|desativar|desativa)\s+alerta\s+respostas?$/.test(t)) {
    return { kind: "resposta", lado: "off" };
  }
  if (liga.test(t) && /^((ligar|liga|ativar|ativa)\s+alerta\s+leads?)$/.test(t)) {
    return { kind: "lead", lado: "on" };
  }
  if (desliga.test(t) && /alerta\s+leads?$/.test(t) && !/resposta/.test(t)) {
    return { kind: "lead", lado: "off" };
  }
  return null;
}

export type ConsultaCrm = "dia" | "semana" | "abertos" | "respostas";

export function fraseConsultaCrm(text: string): ConsultaCrm | null {
  const t = normalizarFrase(text);
  if (!t || t.length > 48) return null;
  if (/^(leads?|clientes?) (do dia|de hoje)$/.test(t)) return "dia";
  if (/^(leads?|clientes?) da semana$/.test(t)) return "semana";
  if (/^(leads?|funil) abertos?$/.test(t)) return "abertos";
  if (/^(quem respondeu hoje|respostas de hoje|leads? que responderam)$/.test(t)) return "respostas";
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
