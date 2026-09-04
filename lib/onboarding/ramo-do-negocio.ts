/**
 * O que o dono escolhe no primeiro passo — três portas, não um campo livre.
 *
 * O texto gravado em `o_que_faz` continua sendo prosa: é o que o funil e o
 * agente leem (`escolherPacotePorTexto`, prompt do atendente). As frases daqui
 * foram escritas para casar com as pistas de `sugerir-funil.ts` — trocar uma
 * palavra sem olhar aquele arquivo muda o quadro que nasce no passo 4.
 */
export const RAMOS_DO_NEGOCIO = [
  {
    id: "locadora",
    rotulo: "Locadora / gestão de frotas",
    desc: "Aluguel de carros, frota para app, cobrança de locatário.",
    oQueFaz: "Locadora de carros e gestão de frotas",
  },
  {
    id: "advocacia",
    rotulo: "Serviços de advocacia",
    desc: "Escritório, banca, captação de cliente e processo.",
    oQueFaz: "Escritório de advocacia",
  },
  {
    id: "outros",
    rotulo: "Outros",
    desc: "Clínica, loja, imobiliária, curso — o que já existia.",
    oQueFaz: null,
  },
] as const;

export type IdDoRamo = (typeof RAMOS_DO_NEGOCIO)[number]["id"];

/** A prosa que vai para o banco — vazia só quando é "outros" sem detalhe. */
export function textoDoRamo(id: IdDoRamo, detalhe?: string): string | undefined {
  const ramo = RAMOS_DO_NEGOCIO.find((r) => r.id === id);
  if (!ramo) return detalhe?.trim() || undefined;
  if (ramo.oQueFaz) return ramo.oQueFaz;
  const livre = detalhe?.trim();
  return livre || undefined;
}
