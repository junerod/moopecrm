/**
 * Resolução de identidade CRM ↔ Gestão.
 *
 * Ordem segura — NUNCA só o nome:
 * 1. vínculo persistido (contact.external_id / moope twin);
 * 2. telefone normalizado (E.164);
 * 3. identificador explícito que o cliente informou;
 * 4. CPF/CNPJ só quando necessário e autorizado.
 *
 * Dado de outro cliente não entra na conversa. Informação financeira
 * pede o retrato da tool, não o RAG.
 */
export const ORDEM_DE_MATCH_IDENTIDADE = [
  "vinculo_persistido",
  "telefone_normalizado",
  "identificador_explicito",
  "cpf_cnpj_autorizado",
] as const;

export type CriterioDeIdentidade = (typeof ORDEM_DE_MATCH_IDENTIDADE)[number];

export function confirmacaoExtraParaDadoSensivel(criterio: CriterioDeIdentidade): boolean {
  return criterio === "cpf_cnpj_autorizado" || criterio === "identificador_explicito";
}
