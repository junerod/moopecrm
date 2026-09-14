import { PACK_CLINICA_MEDICA } from "@/lib/business-packs/modelos/clinica-medica";
import { PACK_CLINICA_ODONTOLOGICA } from "@/lib/business-packs/modelos/clinica-odontologica";
import { PACK_COMERCIAL_GERAL } from "@/lib/business-packs/modelos/comercial-geral";
import { PACK_ESCRITORIO_ADVOCACIA } from "@/lib/business-packs/modelos/escritorio-advocacia";
import { PACK_LOCADORA_VEICULOS } from "@/lib/business-packs/modelos/locadora-veiculos";
import { PACK_VENDAS_SAAS } from "@/lib/business-packs/modelos/vendas-saas";
import { ehBusinessPackId } from "@/lib/business-packs/perfil";
import type { BusinessPackDefinition, BusinessPackId } from "@/lib/business-packs/tipos";

const POR_ID: Record<BusinessPackId, BusinessPackDefinition> = {
  locadora_veiculos: PACK_LOCADORA_VEICULOS,
  escritorio_advocacia: PACK_ESCRITORIO_ADVOCACIA,
  vendas_saas: PACK_VENDAS_SAAS,
  comercial_geral: PACK_COMERCIAL_GERAL,
  clinica_medica: PACK_CLINICA_MEDICA,
  clinica_odontologica: PACK_CLINICA_ODONTOLOGICA,
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
    { id: "locadora_veiculos", label: PACK_LOCADORA_VEICULOS.label, description: PACK_LOCADORA_VEICULOS.description, category: "Locadoras" },
    { id: "escritorio_advocacia", label: PACK_ESCRITORIO_ADVOCACIA.label, description: PACK_ESCRITORIO_ADVOCACIA.description, category: "Serviços profissionais" },
    { id: "vendas_saas", label: PACK_VENDAS_SAAS.label, description: PACK_VENDAS_SAAS.description, category: "Comercial" },
    { id: "comercial_geral", label: PACK_COMERCIAL_GERAL.label, description: PACK_COMERCIAL_GERAL.description, category: "Comercial" },
    { id: "clinica_medica", label: PACK_CLINICA_MEDICA.label, description: PACK_CLINICA_MEDICA.description, category: "Saúde" },
    { id: "clinica_odontologica", label: PACK_CLINICA_ODONTOLOGICA.label, description: PACK_CLINICA_ODONTOLOGICA.description, category: "Saúde" },
  ];
}

export function packParaSubtypeLocacao(subtype: string | null | undefined): BusinessPackId | null {
  return subtype === "veiculos" ? "locadora_veiculos" : null;
}

export function packParaRamo(ramo: string | null | undefined): BusinessPackId | null {
  if (ramo === "advocacia") return "escritorio_advocacia";
  if (ramo === "saas") return "vendas_saas";
  if (ramo === "comercial") return "comercial_geral";
  if (ramo === "locacao") return null;
  return null;
}
