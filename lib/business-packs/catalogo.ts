import { PACK_ESCRITORIO_ADVOCACIA } from "@/lib/business-packs/modelos/escritorio-advocacia";
import { PACK_LOCADORA_VEICULOS } from "@/lib/business-packs/modelos/locadora-veiculos";
import { ehBusinessPackId } from "@/lib/business-packs/perfil";
import type { BusinessPackDefinition, BusinessPackId } from "@/lib/business-packs/tipos";

const POR_ID: Record<BusinessPackId, BusinessPackDefinition> = {
  locadora_veiculos: PACK_LOCADORA_VEICULOS,
  escritorio_advocacia: PACK_ESCRITORIO_ADVOCACIA,
};

export function resolverPack(id: string): BusinessPackDefinition | null {
  if (!ehBusinessPackId(id)) return null;
  return POR_ID[id] ?? null;
}

export function catalogoDePacks(): Array<{
  id: BusinessPackId;
  label: string;
  description: string;
  category: string;
}> {
  return [
    {
      id: "locadora_veiculos",
      label: PACK_LOCADORA_VEICULOS.label,
      description: PACK_LOCADORA_VEICULOS.description,
      category: "Locadoras",
    },
    {
      id: "escritorio_advocacia",
      label: PACK_ESCRITORIO_ADVOCACIA.label,
      description: PACK_ESCRITORIO_ADVOCACIA.description,
      category: "Serviços profissionais",
    },
  ];
}

export function packParaSubtypeLocacao(subtype: string | null | undefined): BusinessPackId | null {
  return subtype === "veiculos" ? "locadora_veiculos" : null;
}

export function packParaRamo(ramo: string | null | undefined): BusinessPackId | null {
  if (ramo === "advocacia") return "escritorio_advocacia";
  if (ramo === "locacao") return null;
  return null;
}
