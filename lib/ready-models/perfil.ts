import {
  READY_MODEL_IDS,
  READY_MODEL_VERSION,
  type PerfilDoNegocioGravado,
  type ReadyModelId,
  type ReadyModelSubtype,
} from "@/lib/ready-models/tipos";
import { ehLocacaoSubtype, resolverIdDoModelo } from "@/lib/ready-models/catalogo";

export const CHAVE_PERFIL = "perfil_do_negocio";

export function lerPerfilDoNegocio(settings: unknown): PerfilDoNegocioGravado | null {
  if (!settings || typeof settings !== "object") return null;
  const bloco = (settings as Record<string, unknown>)[CHAVE_PERFIL];
  if (!bloco || typeof bloco !== "object") return null;
  const raw = bloco as Record<string, unknown>;
  const idBruto = typeof raw.id === "string" ? raw.id : null;
  if (!idBruto) return null;
  const id = resolverIdDoModelo(idBruto);
  if (!id) return null;
  const version = typeof raw.version === "string" && raw.version.length > 0 ? raw.version : READY_MODEL_VERSION;
  const subtypeRaw = typeof raw.subtype === "string" ? raw.subtype : undefined;
  const subtype: ReadyModelSubtype | undefined =
    id === "locacao" && subtypeRaw && ehLocacaoSubtype(subtypeRaw) ? subtypeRaw : undefined;
  const aplicado_em =
    typeof raw.aplicado_em === "string" ? raw.aplicado_em : new Date(0).toISOString();
  return { id, version, subtype, aplicado_em };
}

export function mesmoPerfilAplicado(
  gravado: PerfilDoNegocioGravado | null,
  id: ReadyModelId,
  version: string,
  subtype?: ReadyModelSubtype,
): boolean {
  if (!gravado) return false;
  if (gravado.id !== id) return false;
  if (gravado.version !== version) return false;
  const a = gravado.id === "locacao" ? (gravado.subtype ?? "outros") : (gravado.subtype ?? undefined);
  const b = id === "locacao" ? (subtype ?? "outros") : (subtype ?? undefined);
  return a === b;
}

export function montarBlocoPerfil(
  id: ReadyModelId,
  version: string,
  subtype?: ReadyModelSubtype,
): PerfilDoNegocioGravado {
  return {
    id,
    version,
    ...(subtype ? { subtype } : {}),
    aplicado_em: new Date().toISOString(),
  };
}

export function idsDePerfilAceitos(): string[] {
  return [
    ...READY_MODEL_IDS,
    "locadora",
    "loja",
    "saas",
    "generico",
    "clinica",
    "imobiliaria",
    "curso",
  ];
}
