/**
 * Organiza texto bruto para a Central de Conhecimento.
 * Nunca persiste. Quem chama mostra preview e o humano escolhe.
 */

export const PROMPT_ORGANIZAR_CONHECIMENTO = `Você organiza texto bruto de uma empresa para virar conhecimento útil.

Regras:
- Não invente fatos, números, preços, prazos, códigos ou regras.
- Não apague informação que já está no texto.
- Se o texto for curto, só limpe e estruture — não expanda.
- Use seções quando fizer sentido: Produto, Preço, Condição, Regra, Observação, FAQ.
- Responda APENAS com o texto organizado, sem prefácio nem fechamento.`;

export function montarPromptOrganizar(texto: string, assunto?: string): string {
  const cabeca = assunto?.trim() ? `Assunto: ${assunto.trim()}\n\n` : "";
  return `${cabeca}Texto bruto:\n\n${texto.trim()}`;
}
