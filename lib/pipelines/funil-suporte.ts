/**
 * Molde do funil de Suporte — etapas e vocabulário.
 * Usado pela API de criar-com-template e pelo script one-shot do Comercial MOOPE.
 */
export const NOME_FUNIL_SUPORTE = "Suporte";

export const VOCABULARIO_SUPORTE = {
  lead: "Ticket",
  deal: "Atendimento",
  won: "Resolvido",
  lost: "Não resolvido",
} as const;

export const ETAPAS_FUNIL_SUPORTE: ReadonlyArray<{
  name: string;
  slug: string;
  is_won: boolean;
  is_lost: boolean;
}> = [
  { name: "Novo", slug: "novo", is_won: false, is_lost: false },
  { name: "Em atendimento", slug: "em_atendimento", is_won: false, is_lost: false },
  { name: "Aguardando cliente", slug: "aguardando_cliente", is_won: false, is_lost: false },
  { name: "Resolvido", slug: "resolvido", is_won: true, is_lost: false },
  { name: "Não resolvido", slug: "nao_resolvido", is_won: false, is_lost: true },
];

/** Motivo canônico ao fechar o card de origem no clone entre funis (P-01). */
export const LOST_REASON_MOVED_TO_PIPELINE = "other";
