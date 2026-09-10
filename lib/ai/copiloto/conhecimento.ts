/**
 * Injeta no Copilot só o que o retrieval já escolheu — nunca o acervo inteiro.
 */
import type { OverlayDoCopiloto } from "./overlay";
import { montarSystemDoCopiloto } from "./overlay";
import { RASCUNHO_SEM_FONTE } from "./anti-alucinacao";

export interface TrechoParaCopiloto {
  content: string;
}

export function montarSystemComConhecimento(
  base: string,
  overlay: OverlayDoCopiloto,
  trechos: TrechoParaCopiloto[],
): string {
  const comOverlay = montarSystemDoCopiloto(base, overlay);
  if (trechos.length === 0) {
    return (
      `${comOverlay} CONHECIMENTO DA EMPRESA: nenhum trecho encontrado para esta pergunta. ` +
      `Não invente preço, disponibilidade, prazo, política comercial nem condição de pagamento. ` +
      `Se o cliente perguntar isso, o rascunho deve admitir a ausência: "${RASCUNHO_SEM_FONTE}"`
    );
  }
  const bloco = trechos
    .map((t, i) => `(${i + 1}) ${t.content.trim().slice(0, 800)}`)
    .join("\n");
  return (
    `${comOverlay} CONHECIMENTO DA EMPRESA (use só o que estiver abaixo; ` +
    `não complete com suposição):\n${bloco}`
  );
}
