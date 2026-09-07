import { DEFINITION_ADVOCACIA } from "@/lib/ready-models/modelos/advocacia";
import { DEFINITION_COMERCIAL } from "@/lib/ready-models/modelos/comercial";
import { definitionLocacao } from "@/lib/ready-models/modelos/locacao";
import { DEFINITION_PERSONALIZADO } from "@/lib/ready-models/modelos/personalizado";
import { DEFINITION_SERVICOS } from "@/lib/ready-models/modelos/servicos";
import {
  LOCACAO_SUBTYPES,
  READY_MODEL_IDS,
  type LocacaoSubtype,
  type ReadyModelDefinition,
  type ReadyModelId,
  type ReadyModelSubtype,
} from "@/lib/ready-models/tipos";

/**
 * Aliases do catálogo antigo (PACOTES / perfil-locadora) → Ready Model.
 * O instalador nunca ramifica por estes ids — só o resolvedor.
 */
export const ALIAS_PARA_READY_MODEL: Record<string, ReadyModelId> = {
  locacao: "locacao",
  locadora: "locacao",
  advocacia: "advocacia",
  comercial: "comercial",
  loja: "comercial",
  saas: "comercial",
  servicos: "servicos",
  personalizado: "personalizado",
  generico: "personalizado",
  clinica: "servicos",
  imobiliaria: "locacao",
  curso: "comercial",
};

export function ehReadyModelId(valor: string): valor is ReadyModelId {
  return (READY_MODEL_IDS as readonly string[]).includes(valor);
}

export function ehLocacaoSubtype(valor: string): valor is LocacaoSubtype {
  return (LOCACAO_SUBTYPES as readonly string[]).includes(valor);
}

export function resolverIdDoModelo(idOuAlias: string): ReadyModelId | null {
  return ALIAS_PARA_READY_MODEL[idOuAlias] ?? null;
}

export function resolverDefinition(
  idOuAlias: string,
  subtype?: string | null,
): ReadyModelDefinition | null {
  const id = resolverIdDoModelo(idOuAlias);
  if (!id) return null;
  if (id === "locacao") {
    const sub = subtype && ehLocacaoSubtype(subtype) ? subtype : undefined;
    return definitionLocacao(sub);
  }
  if (id === "advocacia") return DEFINITION_ADVOCACIA;
  if (id === "comercial") return DEFINITION_COMERCIAL;
  if (id === "servicos") return DEFINITION_SERVICOS;
  return DEFINITION_PERSONALIZADO;
}

export function catalogoParaWizard(): Array<{
  id: ReadyModelId;
  label: string;
  description: string;
}> {
  return [
    { id: "locacao", label: "Locação", description: "Aluga veículos, máquinas, ferramentas, imóveis ou outros bens." },
    { id: "advocacia", label: "Advocacia", description: "Escritório: triagem, documentos e contratação." },
    { id: "comercial", label: "Comercial / Vendas", description: "Vende produtos ou serviços." },
    { id: "servicos", label: "Serviços", description: "Orça e executa um serviço." },
    { id: "personalizado", label: "Personalizado", description: "Montar o quadro do seu jeito." },
  ];
}

export const ROTULOS_SUBTYPE_LOCACAO: Record<LocacaoSubtype, string> = {
  veiculos: "Veículos",
  maquinas_e_equipamentos: "Máquinas e equipamentos",
  ferramentas: "Ferramentas",
  imoveis: "Imóveis",
  outros: "Outros",
};

export function listarSubtypes(id: ReadyModelId): ReadyModelSubtype[] {
  return id === "locacao" ? [...LOCACAO_SUBTYPES] : [];
}
