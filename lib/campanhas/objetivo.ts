import type { ObjetivoDaCampanha } from "@/lib/campanhas/tipos";

export interface CardDeObjetivo {
  id: ObjetivoDaCampanha;
  titulo: string;
  descricao: string;
}

export const CARDS_DE_OBJETIVO: CardDeObjetivo[] = [
  {
    id: "promocao",
    titulo: "Promoção / oferta",
    descricao: "Divulgar condição, desconto ou novidade comercial.",
  },
  {
    id: "reativacao",
    titulo: "Reativação",
    descricao: "Voltar a falar com quem parou de comprar ou alugar.",
  },
  {
    id: "followup",
    titulo: "Follow-up",
    descricao: "Retomar proposta, orçamento ou conversa em aberto.",
  },
  {
    id: "aviso",
    titulo: "Aviso importante",
    descricao: "Comunicado pontual, sem tom de venda.",
  },
  {
    id: "pesquisa",
    titulo: "Pesquisa / satisfação",
    descricao: "Perguntar como foi a experiência.",
  },
  {
    id: "personalizada",
    titulo: "Personalizada",
    descricao: "Objetivo livre — você escreve o conteúdo.",
  },
];

export function rotuloDoObjetivo(id: string | null | undefined): string {
  return CARDS_DE_OBJETIVO.find((c) => c.id === id)?.titulo ?? "Personalizada";
}
