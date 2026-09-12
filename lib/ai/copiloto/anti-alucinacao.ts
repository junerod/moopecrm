/**
 * Quando o conhecimento necessário não existe, a IA não inventa.
 *
 * Preço, prazo, disponibilidade, política e condição de pagamento são
 * dados operacionais: a fonte é o CRM / o conhecimento cadastrado, não o
 * modelo. Sem trecho acima do limiar, o rascunho admite a ausência.
 */

const PIDE_DADO_CRITICO =
  /pre[cç]o|custa|valor|di[aá]ria|disponi|estoque|prazo|entrega|parcela|desconto|pol[ií]tica|garantia|pagamento|boleto|condi[cç][aã]o/i;

const PIDE_DADO_GESTAO =
  /loca[cç][aã]o|locat[aá]ri|ve[ií]culo|cobran[cç]a|contrato|gest[aã]o|placa|multa|sinistro|vistoria/i;

export const NAO_CONSEGUI_CONSULTAR_GESTAO = "Não consegui consultar agora.";

export function perguntaPedeDadoGestao(texto: string | null | undefined): boolean {
  return PIDE_DADO_GESTAO.test((texto ?? "").trim());
}

export function perguntaPedeDadoCritico(texto: string | null | undefined): boolean {
  return PIDE_DADO_CRITICO.test((texto ?? "").trim());
}

export const RASCUNHO_SEM_FONTE =
  "Não tenho esse dado no conhecimento da empresa. Confirme com a equipe antes de responder ao cliente.";

export function deveRecusarInventar(
  pergunta: string | null | undefined,
  trechosEncontrados: number,
): boolean {
  return perguntaPedeDadoCritico(pergunta) && trechosEncontrados <= 0;
}
