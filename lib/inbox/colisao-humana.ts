/**
 * Colisão humano × humano — em cima do owner atual, sem máquina de lock nova.
 *
 * Visualizar ≠ responder. Manager com visibility=all VÊ a conversa do colega;
 * o envio como se fosse atendimento próprio é que é recusado. Claim/transfer
 * continuam sendo o caminho para tomar o comando (`fn_conversation_assign`).
 */
export type DecisaoDeColisaoHumana =
  | { podeEnviar: true }
  | { podeEnviar: false; ownerId: string };

export function decisaoDeColisaoHumana(entrada: {
  viewerUserId: string;
  assignedToUserId: string | null | undefined;
}): DecisaoDeColisaoHumana {
  const dono = entrada.assignedToUserId ?? null;
  if (!dono || dono === entrada.viewerUserId) return { podeEnviar: true };
  return { podeEnviar: false, ownerId: dono };
}
