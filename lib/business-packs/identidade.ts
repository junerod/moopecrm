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

export type ChaveDeIdentidade = {
  external_id?: string | null;
  telefone?: string | null;
  identificador?: string | null;
  cpf_cnpj?: string | null;
  nome?: string | null;
};

export type ResultadoDeIdentidade =
  | { ok: true; criterio: CriterioDeIdentidade }
  | { ok: false; motivo: "insuficiente" | "nome_sozinho" };

/** Nome sozinho nunca identifica. Falha fechada se só houver nome. */
export function resolverCriterioDeIdentidade(chave: ChaveDeIdentidade): ResultadoDeIdentidade {
  if (typeof chave.external_id === "string" && chave.external_id.trim()) {
    return { ok: true, criterio: "vinculo_persistido" };
  }
  if (typeof chave.telefone === "string" && chave.telefone.replace(/\D/g, "").length >= 10) {
    return { ok: true, criterio: "telefone_normalizado" };
  }
  if (typeof chave.identificador === "string" && chave.identificador.trim()) {
    return { ok: true, criterio: "identificador_explicito" };
  }
  if (typeof chave.cpf_cnpj === "string" && chave.cpf_cnpj.replace(/\D/g, "").length >= 11) {
    return { ok: true, criterio: "cpf_cnpj_autorizado" };
  }
  if (typeof chave.nome === "string" && chave.nome.trim()) {
    return { ok: false, motivo: "nome_sozinho" };
  }
  return { ok: false, motivo: "insuficiente" };
}
