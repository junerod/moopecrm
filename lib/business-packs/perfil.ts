import {
  BUSINESS_PACK_IDS,
  CHAVE_PACK,
  type BusinessPackGravado,
  type BusinessPackId,
  type PackArtifacts,
} from "@/lib/business-packs/tipos";

export function ehBusinessPackId(valor: string): valor is BusinessPackId {
  return (BUSINESS_PACK_IDS as readonly string[]).includes(valor);
}

export function artifactsVazios(): PackArtifacts {
  return {
    agent_keys: {},
    collection_slugs: {},
    template_keys: {},
    automation_keys: {},
    campaign_keys: {},
    followup_keys: {},
  };
}

export function lerPackGravado(settings: unknown): BusinessPackGravado | null {
  if (!settings || typeof settings !== "object") return null;
  const bloco = (settings as Record<string, unknown>)[CHAVE_PACK];
  if (!bloco || typeof bloco !== "object") return null;
  const raw = bloco as Record<string, unknown>;
  if (typeof raw.id !== "string" || !ehBusinessPackId(raw.id)) return null;
  if (typeof raw.version !== "string" || raw.version.length === 0) return null;
  const artifacts = normalizarArtifacts(raw.artifacts);
  return {
    id: raw.id,
    version: raw.version,
    installed_at: typeof raw.installed_at === "string" ? raw.installed_at : new Date(0).toISOString(),
    artifacts,
    status: raw.status === "inactive" ? "inactive" : "active",
  };
}

export function mesmoPackAplicado(
  gravado: BusinessPackGravado | null,
  id: BusinessPackId,
  version: string,
): boolean {
  if (!gravado) return false;
  return gravado.id === id && gravado.version === version;
}

export function montarBlocoPack(
  id: BusinessPackId,
  version: string,
  artifacts: PackArtifacts,
  installedAt?: string,
): BusinessPackGravado {
  return {
    id,
    version,
    installed_at: installedAt ?? new Date().toISOString(),
    artifacts,
    status: "active",
  };
}

function mapaDeIds(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    if (typeof v === "string" && v.length > 0) out[k] = v;
  }
  return out;
}

function normalizarArtifacts(valor: unknown): PackArtifacts {
  const raw = valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {};
  return {
    pipeline_id: typeof raw.pipeline_id === "string" ? raw.pipeline_id : undefined,
    router_id: typeof raw.router_id === "string" ? raw.router_id : undefined,
    agent_keys: mapaDeIds(raw.agent_keys),
    collection_slugs: mapaDeIds(raw.collection_slugs),
    template_keys: mapaDeIds(raw.template_keys),
    automation_keys: mapaDeIds(raw.automation_keys),
    campaign_keys: mapaDeIds(raw.campaign_keys),
    followup_keys: mapaDeIds(raw.followup_keys),
  };
}

/** Junta artefatos novos sem apagar ids já gravados (customização do cliente). */
export function fundirArtifacts(atual: PackArtifacts, extra: PackArtifacts): PackArtifacts {
  return {
    pipeline_id: atual.pipeline_id ?? extra.pipeline_id,
    router_id: atual.router_id ?? extra.router_id,
    agent_keys: { ...extra.agent_keys, ...atual.agent_keys },
    collection_slugs: { ...extra.collection_slugs, ...atual.collection_slugs },
    template_keys: { ...extra.template_keys, ...atual.template_keys },
    automation_keys: { ...extra.automation_keys, ...atual.automation_keys },
    campaign_keys: { ...extra.campaign_keys, ...atual.campaign_keys },
    followup_keys: { ...extra.followup_keys, ...atual.followup_keys },
  };
}
