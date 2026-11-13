/**
 * Título sugerido ao salvar o texto da caixa como resposta rápida.
 * A pessoa corrige as palavras no diálogo antes de gravar.
 */
export function tituloDaRespostaRapida(corpo: string): string {
  const linha = corpo.trim().split(/\n/)[0]?.trim() ?? "";
  if (!linha) return "Resposta rápida";
  if (linha.length <= 60) return linha;
  return `${linha.slice(0, 57)}…`;
}
