/**
 * As portas do primeiro passo — Ready Models, sem jargão.
 */
import { catalogoParaWizard, ROTULOS_SUBTYPE_LOCACAO } from "@/lib/ready-models/catalogo";
import {
  LOCACAO_SUBTYPES,
  READY_MODEL_IDS,
  type LocacaoSubtype,
  type ReadyModelId,
} from "@/lib/ready-models/tipos";

export const RAMOS_DO_NEGOCIO = catalogoParaWizard().map((r) => ({
  id: r.id,
  rotulo: r.label,
  desc: r.description,
}));

export type IdDoRamo = ReadyModelId;

export const SUBTYPES_LOCACAO = LOCACAO_SUBTYPES;
export type SubtypeLocacao = LocacaoSubtype;

export const ROTULOS_SUBTYPE = ROTULOS_SUBTYPE_LOCACAO;

const PROSA: Record<ReadyModelId, string> = {
  locacao: "Locação de bens",
  advocacia: "Escritório de advocacia",
  comercial: "Comercial e vendas",
  servicos: "Prestação de serviços",
  personalizado: "Atendimento personalizado",
};

/** A prosa que vai para o banco — o funil e o Copilot leem isto, não o id. */
export function textoDoRamo(
  id: ReadyModelId,
  detalhe?: string,
  subtype?: LocacaoSubtype,
): string | undefined {
  if (id === "personalizado") {
    const livre = detalhe?.trim();
    return livre || PROSA.personalizado;
  }
  if (id === "locacao" && subtype) {
    return `Locação — ${ROTULOS_SUBTYPE_LOCACAO[subtype]}`;
  }
  return PROSA[id];
}

export function ehReadyModelDoWizard(valor: string): valor is ReadyModelId {
  return (READY_MODEL_IDS as readonly string[]).includes(valor);
}
