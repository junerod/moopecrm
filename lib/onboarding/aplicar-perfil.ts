/**
 * Aplica um pacote de funil numa org que JÁ existe — e deixa trocar depois.
 *
 * O wizard só roda uma vez. Quem testa perfis, ou a própria instalação que
 * vende o sistema para locadoras, precisa poder escolher de novo em
 * Configurações. Trocar NÃO apaga funil com card: o RPC recusa
 * `funil_com_negocios`, e aí nasce um quadro novo que vira o padrão.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { slugDeNome } from "@/lib/leads/stage-editing";
import { PACOTES, type PacoteDeFunil } from "@/lib/onboarding/pacotes-de-funil";
import { aplicarPerfilAdvocacia } from "@/lib/onboarding/perfil-advocacia";
import { aplicarPerfilLocadora } from "@/lib/onboarding/perfil-locadora";
import {
  etapasParaGravar,
  type PropostaDeFunil,
} from "@/lib/onboarding/proposta-de-funil";

export const IDS_DE_PERFIL = PACOTES.map((p) => p.id);
export type IdDePerfil = (typeof PACOTES)[number]["id"];

export const CHAVE_PERFIL = "perfil_do_negocio";

const HORAS_POR_PASSO: Record<string, number> = {
  new: 24,
  contacted: 48,
  qualifying: 72,
  qualified: 48,
  negotiating: 72,
};

export function pacoteDoPerfil(id: string): PacoteDeFunil | null {
  return PACOTES.find((p) => p.id === id) ?? null;
}

export function lerPerfilGravado(settings: unknown): IdDePerfil | null {
  if (!settings || typeof settings !== "object") return null;
  const bloco = (settings as Record<string, unknown>)[CHAVE_PERFIL];
  if (!bloco || typeof bloco !== "object") return null;
  const id = (bloco as { id?: unknown }).id;
  if (typeof id !== "string") return null;
  return pacoteDoPerfil(id)?.id ?? null;
}

/** Quando settings ainda não tem a chave — o quadro padrão denuncia o perfil. */
export function inferirPerfilPeloNomeDoQuadro(nome: string | null | undefined): IdDePerfil | null {
  if (!nome) return null;
  return PACOTES.find((p) => p.proposta.nome === nome)?.id ?? null;
}

export function quadroJaServeOPacote(nomes: string[], proposta: PropostaDeFunil): boolean {
  const ganho = proposta.etapas.find((e) => e.passo === "won")?.nome;
  const perdido = proposta.etapas.find((e) => e.passo === "lost")?.nome;
  if (!ganho || !perdido) return false;
  return nomes.includes(ganho) && nomes.includes(perdido);
}

export type ResultadoDoPerfil = {
  perfil: IdDePerfil;
  pipelinePadraoId: string;
  criouQuadroNovo: boolean;
};

export async function aplicarPerfilDoNegocio(
  admin: SupabaseClient,
  orgId: string,
  id: IdDePerfil,
): Promise<ResultadoDoPerfil> {
  const pacote = pacoteDoPerfil(id);
  if (!pacote) throw new Error(`perfil desconhecido: ${id}`);

  if (id === "locadora") {
    await aplicarPerfilLocadora(admin, orgId);
  } else if (id === "advocacia") {
    await aplicarPerfilAdvocacia(admin, orgId);
  }

  const quadro = await garantirQuadroComoPadrao(admin, orgId, pacote.proposta);
  await gravarPerfil(admin, orgId, id);
  return { perfil: id, pipelinePadraoId: quadro.id, criouQuadroNovo: quadro.criou };
}

export async function garantirQuadroComoPadrao(
  admin: SupabaseClient,
  orgId: string,
  proposta: PropostaDeFunil,
): Promise<{ id: string; criou: boolean }> {
  const { data: padrao, error: erroPadrao } = await admin
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  if (erroPadrao || !padrao) {
    throw new Error(`sem funil padrão: ${erroPadrao?.message ?? "não achei"}`);
  }
  const padraoId = (padrao as { id: string }).id;

  const { data: etapas } = await admin
    .from("crm_stages")
    .select("name")
    .eq("organization_id", orgId)
    .eq("pipeline_id", padraoId);
  const nomes = (etapas ?? []).map((e) => (e as { name: string }).name);
  if (quadroJaServeOPacote(nomes, proposta)) {
    await admin
      .from("crm_pipelines")
      .update({ name: proposta.nome } as never)
      .eq("id", padraoId)
      .eq("organization_id", orgId);
    return { id: padraoId, criou: false };
  }

  const { data: slugs } = await admin
    .from("crm_pipelines")
    .select("slug")
    .eq("organization_id", orgId);
  const slug = slugDeNome(
    proposta.nome,
    (slugs ?? []).map((p) => String((p as { slug?: string }).slug ?? "")),
    "funil",
  );

  const { data: resposta } = await admin.rpc("fn_aplicar_quadro_do_onboarding", {
    p_organization_id: orgId,
    p_pipeline_id: padraoId,
    p_nome: proposta.nome,
    p_slug: slug,
    p_etapas: etapasParaGravar(proposta, slugDeNome).map((e) => ({
      nome: e.nome,
      slug: e.slug,
      position: e.position,
      is_won: e.is_won,
      is_lost: e.is_lost,
      agent_stage_hint: e.agent_stage_hint,
    })),
  });
  const r = (resposta ?? {}) as { ok?: boolean; motivo?: string };
  if (r.ok === true) return { id: padraoId, criou: false };
  if (r.ok === false && r.motivo !== "funil_com_negocios") {
    throw new Error(`aplicar quadro: ${r.motivo ?? "recusa"}`);
  }

  const { data: porNome } = await admin
    .from("crm_pipelines")
    .select("id")
    .eq("organization_id", orgId)
    .eq("name", proposta.nome)
    .eq("is_archived", false)
    .maybeSingle();
  if (porNome) {
    const id = (porNome as { id: string }).id;
    if (id !== padraoId) await promoverAPadrao(admin, orgId, padraoId, id);
    return { id, criou: false };
  }

  const { error: erroTira } = await admin
    .from("crm_pipelines")
    .update({ is_default: false } as never)
    .eq("id", padraoId)
    .eq("organization_id", orgId);
  if (erroTira) throw new Error(`tirar padrão velho: ${erroTira.message}`);

  const { data: novo, error: erroNovo } = await admin
    .from("crm_pipelines")
    .insert({
      organization_id: orgId,
      name: proposta.nome,
      slug,
      is_default: true,
      position: 100,
    } as never)
    .select("id")
    .single();
  if (erroNovo || !novo) throw new Error(`criar quadro: ${erroNovo?.message}`);
  const id = (novo as { id: string }).id;

  const etapasNovas = etapasParaGravar(proposta, slugDeNome);
  const { error: erroEtapas } = await admin.from("crm_stages").insert(
    etapasNovas.map((e) => ({
      organization_id: orgId,
      pipeline_id: id,
      name: e.nome,
      slug: e.slug,
      position: e.position,
      is_won: e.is_won,
      is_lost: e.is_lost,
      agent_stage_hint: e.agent_stage_hint,
      expected_duration_hours: e.agent_stage_hint
        ? (HORAS_POR_PASSO[e.agent_stage_hint] ?? null)
        : null,
    })) as never,
  );
  if (erroEtapas) throw new Error(`etapas do quadro: ${erroEtapas.message}`);
  return { id, criou: true };
}

async function promoverAPadrao(
  admin: SupabaseClient,
  orgId: string,
  atualId: string,
  novoId: string,
): Promise<void> {
  const { error: a } = await admin
    .from("crm_pipelines")
    .update({ is_default: false } as never)
    .eq("id", atualId)
    .eq("organization_id", orgId);
  if (a) throw new Error(`tirar padrão: ${a.message}`);
  const { error: b } = await admin
    .from("crm_pipelines")
    .update({ is_default: true } as never)
    .eq("id", novoId)
    .eq("organization_id", orgId);
  if (b) throw new Error(`marcar padrão: ${b.message}`);
}

async function gravarPerfil(
  admin: SupabaseClient,
  orgId: string,
  id: IdDePerfil,
): Promise<void> {
  const { data } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  const atual =
    data?.settings && typeof data.settings === "object"
      ? { ...(data.settings as Record<string, unknown>) }
      : {};
  const { error } = await admin
    .from("organizations")
    .update({
      settings: {
        ...atual,
        [CHAVE_PERFIL]: { id, aplicado_em: new Date().toISOString() },
      },
    } as never)
    .eq("id", orgId);
  if (error) throw new Error(`gravar perfil: ${error.message}`);
}
