import type { ObjetivoDaCampanha } from "@/lib/campanhas/tipos";

export interface CardDeObjetivo {
  id: ObjetivoDaCampanha;
  titulo: string;
  descricao: string;
  rascunho: string;
  dicasDeModelo: string[];
}

export const CARDS_DE_OBJETIVO: CardDeObjetivo[] = [
  {
    id: "promocao",
    titulo: "Promoção / oferta",
    descricao: "Divulgar condição, desconto ou novidade comercial.",
    rascunho:
      "Oi {{nome}}, separei uma condição especial para você. Quer que eu te mostre o que cabe agora?",
    dicasDeModelo: ["oferta", "condições", "novidade", "frota"],
  },
  {
    id: "reativacao",
    titulo: "Reativação",
    descricao: "Voltar a falar com quem parou de comprar ou alugar.",
    rascunho:
      "Oi {{nome}}, faz um tempo que não nos falamos. Quando quiser de novo, é só responder esta mensagem.",
    dicasDeModelo: ["volte", "alugar", "antigos", "nova locação"],
  },
  {
    id: "followup",
    titulo: "Follow-up",
    descricao: "Retomar proposta, orçamento ou conversa em aberto.",
    rascunho:
      "Oi {{nome}}, seu orçamento ainda está em aberto. Posso te ajudar a fechar ou ajustar alguma coisa?",
    dicasDeModelo: ["orçamento", "aberto", "renovação", "prorrogação"],
  },
  {
    id: "aviso",
    titulo: "Aviso importante",
    descricao: "Comunicado pontual, sem tom de venda.",
    rascunho:
      "Oi {{nome}}, passando um aviso importante. Qualquer dúvida, é só responder aqui.",
    dicasDeModelo: ["aviso", "renovação", "prorrogação"],
  },
  {
    id: "pesquisa",
    titulo: "Pesquisa / satisfação",
    descricao: "Perguntar como foi a experiência.",
    rascunho: "Oi {{nome}}, como foi sua experiência com a gente? Sua resposta nos ajuda a melhorar.",
    dicasDeModelo: ["experiência", "satisfação", "como foi"],
  },
  {
    id: "personalizada",
    titulo: "Personalizada",
    descricao: "Objetivo livre — você escreve o conteúdo.",
    rascunho: "",
    dicasDeModelo: [],
  },
];

export function rascunhoDoObjetivo(id: ObjetivoDaCampanha): string {
  return CARDS_DE_OBJETIVO.find((c) => c.id === id)?.rascunho ?? "";
}

export function modeloCombinaComObjetivo(titulo: string, id: ObjetivoDaCampanha): boolean {
  const dicas = CARDS_DE_OBJETIVO.find((c) => c.id === id)?.dicasDeModelo ?? [];
  if (dicas.length === 0) return true;
  const t = titulo.toLowerCase();
  return dicas.some((d) => t.includes(d.toLowerCase()));
}

export function rotuloDoObjetivo(id: string | null | undefined): string {
  return CARDS_DE_OBJETIVO.find((c) => c.id === id)?.titulo ?? "Personalizada";
}
