/** Progresso da importação de conversas antigas. Sem dependência de servidor. */
export type StatusDoHistorico = "rodando" | "pronto" | "erro";

export type ProgressoHistorico = {
  status: StatusDoHistorico;
  iniciado_em: string;
  terminado_em?: string;
  /** Contatos gravados na lista nesta rodada. */
  contatos?: number;
  conversas: number;
  mensagens: number;
  puladas: number;
  motivo?: string;
  /**
   * A loja do aparelho veio com poucos nomes. O WhatsApp não entregou
   * a agenda antiga nesta sessão — reconectar (às vezes com QR novo)
   * é o que faz ele reenviar.
   */
  loja_curta?: boolean;
};

/** Quem já tem fio no inbox atualiza; quem não tem, importa. */
export function rotuloImportarConversa(jaTemFio: boolean, compact: boolean): string {
  if (jaTemFio) return compact ? "Atualizar" : "Atualizar conversa";
  return compact ? "Importar" : "Importar conversa";
}

/** Dá para pedir o fio do aparelho: tem telefone ou o id do chat. */
export function contatoPodeImportarConversa(c: {
  is_anonymized?: boolean;
  phone_number?: string | null;
  source_metadata?: Record<string, unknown> | null;
}): boolean {
  if (c.is_anonymized) return false;
  if (c.phone_number && c.phone_number.replace(/\D/g, "").length >= 8) return true;
  const id = c.source_metadata?.waha_chat_id;
  if (typeof id !== "string" || id.length === 0) return false;
  const baixo = id.toLowerCase();
  return baixo.endsWith("@c.us") || baixo.endsWith("@s.whatsapp.net");
}
