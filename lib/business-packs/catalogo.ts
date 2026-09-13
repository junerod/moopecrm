import { PACK_LOCADORA_VEICULOS } from "@/lib/business-packs/modelos/locadora-veiculos";
import { ehBusinessPackId } from "@/lib/business-packs/perfil";
import type { BusinessPackDefinition, BusinessPackId } from "@/lib/business-packs/tipos";

const POR_ID: Record<BusinessPackId, BusinessPackDefinition> = {
  locadora_veiculos: PACK_LOCADORA_VEICULOS,
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
  ];
}

export function packParaSubtypeLocacao(subtype: string | null | undefined): BusinessPackId | null {
  return subtype === "veiculos" ? "locadora_veiculos" : null;
}
