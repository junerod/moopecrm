/**
 * Retrieval do Copilot — o mesmo acervo do produto, nunca o tenant vizinho.
 *
 * `organizationId` vem de cookie/JWT/job. O corpo da pergunta não escolhe org.
 * Vetor quando a KB já existe; FAQ da mesma org quando o indexador ainda
 * não rodou. Não é um segundo RAG: lê as mesmas linhas que o indexer consome.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buscarConhecimento,
  resolverAcervoDoAgente,
  type TrechoEncontrado,
} from "@/lib/ai/knowledge/busca";

export interface RecuperacaoDaEmpresa {
  trechos: Array<{ content: string; fonte: string | null; pagina?: number; secao?: string }>;
  origem: "vetor" | "cadastro" | "vazio";
}

export async function resolverAgenteDoAcervo(
  db: SupabaseClient,
  organizationId: string,
): Promise<{ id: string; kbVersionId: string | null } | null> {
  const { data: padrao } = await db
    .from("ai_agents")
    .select("id, active_kb_version_id")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .is("archived_at", null)
    .maybeSingle();
  if (padrao) {
    return {
      id: padrao.id as string,
      kbVersionId: (padrao.active_kb_version_id as string | null) ?? null,
    };
  }
  const { data: qualquer } = await db
    .from("ai_agents")
    .select("id, active_kb_version_id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!qualquer) return null;
  return {
    id: qualquer.id as string,
    kbVersionId: (qualquer.active_kb_version_id as string | null) ?? null,
  };
}

/** Palavras que toda pergunta de preço/produto carrega — sozinhas não identificam o item. */
const TERMOS_GENERICOS = new Set([
  "quanto",
  "quantos",
  "quantas",
  "custa",
  "custam",
  "custo",
  "preco",
  "valor",
  "valores",
  "produto",
  "produtos",
  "desse",
  "dessa",
  "deste",
  "desta",
  "qual",
  "quais",
  "como",
  "onde",
  "quando",
  "voces",
  "voce",
  "este",
  "essa",
  "isso",
  "aqui",
  "para",
  "pela",
  "pelo",
  "temos",
  "neste",
  "nesta",
]);

export async function buscarFaqDaOrg(
  db: SupabaseClient,
  organizationId: string,
  pergunta: string,
): Promise<Array<{ content: string; fonte: string | null }>> {
  const termos = (pergunta ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 4 && !TERMOS_GENERICOS.has(t))
    .slice(0, 6);
  if (termos.length === 0) return [];

  const { data: fontes } = await db
    .from("ai_knowledge_sources")
    .select("id, name")
    .eq("organization_id", organizationId)
    .eq("is_active", true);
  const ids = (fontes ?? []).map((f) => f.id as string);
  if (ids.length === 0) return [];
  const nomePorFonte = new Map((fontes ?? []).map((f) => [f.id as string, f.name as string]));

  const { data: itens } = await db
    .from("ai_faq_items")
    .select("question, answer, knowledge_source_id")
    .eq("organization_id", organizationId)
    .in("knowledge_source_id", ids)
    .limit(40);

  const hits: Array<{ content: string; fonte: string | null; pagina?: number }> = [];
  for (const item of itens ?? []) {
    const blob = `${item.question ?? ""} ${item.answer ?? ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (!termos.some((t) => blob.includes(t))) continue;
    hits.push({
      content: `${item.question ?? ""}\n${item.answer ?? ""}`.trim(),
      fonte: nomePorFonte.get(item.knowledge_source_id as string) ?? "Cadastro da empresa",
    });
    if (hits.length >= 5) break;
  }
  return hits;
}

export async function buscarDocumentosDaOrg(
  db: SupabaseClient,
  organizationId: string,
  pergunta: string,
): Promise<Array<{ content: string; fonte: string | null; pagina?: number }>> {
  const termos = (pergunta ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 4 && !TERMOS_GENERICOS.has(t))
    .slice(0, 6);
  if (termos.length === 0) return [];

  const { data: fontes } = await db
    .from("ai_knowledge_sources")
    .select("id, name, source_type, source_metadata")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .eq("status", "ready")
    .eq("source_type", "policy");

  const hits: Array<{ content: string; fonte: string | null; pagina?: number; secao?: string }> = [];
  for (const fonte of fontes ?? []) {
    const meta = (fonte.source_metadata ?? {}) as Record<string, unknown>;
    const pages = Array.isArray(meta.pages)
      ? (meta.pages as Array<{ pagina?: number; secao?: string; texto?: string }>)
      : [];
    const texto =
      pages.length > 0
        ? null
        : typeof meta.extracted_text === "string"
          ? meta.extracted_text
          : "";
    const nome =
      (typeof meta.filename === "string" && meta.filename) ||
      (fonte.name as string) ||
      "Documento";

    if (pages.length > 0) {
      for (const p of pages) {
        const blob = String(p.texto ?? "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{M}/gu, "");
        if (!termos.some((t) => blob.includes(t))) continue;
        hits.push({
          content: String(p.texto ?? "").trim(),
          fonte: nome,
          pagina: typeof p.pagina === "number" ? p.pagina : undefined,
          secao: typeof p.secao === "string" ? p.secao : undefined,
        });
        if (hits.length >= 5) return hits;
      }
      continue;
    }

    if (!texto) continue;
    const blob = texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (!termos.some((t) => blob.includes(t))) continue;
    hits.push({ content: texto.trim().slice(0, 2000), fonte: nome });
    if (hits.length >= 5) break;
  }
  return hits;
}

function fonteDoTrecho(t: TrechoEncontrado): {
  fonte: string | null;
  pagina?: number;
  secao?: string;
} {
  const meta = t.metadata ?? {};
  const filename = typeof meta.filename === "string" ? meta.filename : null;
  const pagina = typeof meta.page === "number" ? meta.page : undefined;
  const secao = typeof meta.section === "string" ? meta.section : undefined;
  return {
    fonte: filename ?? "Conhecimento da empresa",
    ...(pagina !== undefined ? { pagina } : {}),
    ...(secao ? { secao } : {}),
  };
}

export async function recuperarConhecimentoDaEmpresa(
  db: SupabaseClient,
  organizationId: string,
  pergunta: string,
): Promise<RecuperacaoDaEmpresa> {
  const agente = await resolverAgenteDoAcervo(db, organizationId);
  if (agente?.kbVersionId) {
    try {
      const kb =
        (await resolverAcervoDoAgente(db, organizationId, agente.id)) ?? agente.kbVersionId;
      const r = await buscarConhecimento(db, {
        organizationId,
        kbVersionId: kb,
        pergunta,
        topK: 5,
        limiar: 0.35,
      });
      if (r.trechos.length > 0) {
        return {
          trechos: r.trechos.map((t: TrechoEncontrado) => {
            const citacao = fonteDoTrecho(t);
            return {
              content: t.content,
              fonte: citacao.fonte,
              ...(citacao.pagina !== undefined ? { pagina: citacao.pagina } : {}),
              ...(citacao.secao ? { secao: citacao.secao } : {}),
            };
          }),
          origem: "vetor",
        };
      }
    } catch {
      /* indexador/embedding ausente: cai no cadastro da mesma org */
    }
  }

  const faq = await buscarFaqDaOrg(db, organizationId, pergunta);
  if (faq.length > 0) return { trechos: faq, origem: "cadastro" };
  const docs = await buscarDocumentosDaOrg(db, organizationId, pergunta);
  if (docs.length > 0) return { trechos: docs, origem: "cadastro" };
  return { trechos: [], origem: "vazio" };
}
