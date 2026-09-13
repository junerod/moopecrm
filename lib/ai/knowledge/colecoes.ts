/**
 * Coleções = escopo do MESMO Knowledge. Sem segundo RAG, sem tabela nova:
 * lista em organizations.settings.knowledge_collections; vínculo em
 * source_metadata.collection_ids; filtro do agente em ai_agents.config.
 */

export interface ColecaoDeConhecimento {
  id: string;
  name: string;
  slug: string;
}

export const COLECOES_PADRAO: Array<{ name: string; slug: string }> = [
  { name: "Suporte", slug: "suporte" },
  { name: "Comercial", slug: "comercial" },
  { name: "Jurídico", slug: "juridico" },
  { name: "Conhecimento geral", slug: "geral" },
];

export function lerColecoesDoSettings(settings: unknown): ColecaoDeConhecimento[] {
  const s = settings && typeof settings === "object" ? (settings as Record<string, unknown>) : {};
  const raw = s.knowledge_collections;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const o = item as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.name !== "string") return null;
      return {
        id: o.id,
        name: o.name,
        slug: typeof o.slug === "string" ? o.slug : slugify(o.name),
      };
    })
    .filter((c): c is ColecaoDeConhecimento => c !== null);
}

export function slugify(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function idsDeColecaoDoMeta(meta: Record<string, unknown> | null | undefined): string[] {
  const raw = meta?.collection_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function idsDeColecaoDoAgente(config: Record<string, unknown> | null | undefined): string[] {
  const raw = config?.knowledge_collection_ids;
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * Sem coleção marcada no agente = vê tudo (agentes existentes não quebram).
 * Fonte sem coleção entra no acervo geral.
 */
export function fontePermitidaNaColecao(
  collectionIdsDaFonte: string[],
  collectionIdsDoAgente: string[],
): boolean {
  if (collectionIdsDoAgente.length === 0) return true;
  if (collectionIdsDaFonte.length === 0) return collectionIdsDoAgente.length === 0;
  return collectionIdsDaFonte.some((id) => collectionIdsDoAgente.includes(id));
}
