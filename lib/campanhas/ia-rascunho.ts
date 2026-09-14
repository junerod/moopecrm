/**
 * IA só mexe no DRAFT. Nunca envia, nunca escolhe destinatário, nunca inicia.
 */
export const ACOES_DE_RASCUNHO = [
  "melhorar",
  "encurtar",
  "comercial",
  "profissional",
  "tres_versoes",
] as const;
export type AcaoDeRascunho = (typeof ACOES_DE_RASCUNHO)[number];

export function reescreverRascunhoLocal(
  texto: string,
  acao: AcaoDeRascunho,
): { texto: string; versoes: string[] } {
  const limpo = texto.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (acao === "encurtar") {
    const curto = limpo.length > 220 ? `${limpo.slice(0, 200).trim()}…` : limpo;
    return { texto: curto, versoes: [curto] };
  }
  if (acao === "comercial") {
    const t = limpo.startsWith("Olá") ? limpo : `Olá! ${limpo}`;
    return { texto: t, versoes: [t] };
  }
  if (acao === "profissional") {
    const t = limpo.replace(/\b(oi+|hey)\b/gi, "Olá").replace(/!{2,}/g, ".");
    return { texto: t, versoes: [t] };
  }
  if (acao === "tres_versoes") {
    const a = limpo;
    const b = limpo.startsWith("Olá") ? limpo : `Olá! ${limpo}`;
    const c = limpo.length > 220 ? `${limpo.slice(0, 200).trim()}…` : limpo;
    return { texto: a, versoes: [a, b, c] };
  }
  return { texto: limpo, versoes: [limpo] };
}
