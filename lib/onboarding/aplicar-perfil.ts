/**
 * Facade do perfil do negócio — delega ao instalador genérico de Ready Model.
 *
 * Callers antigos (settings, scripts) continuam importando daqui.
 * O ramo específico (locadora/advocacia) NÃO entra mais neste arquivo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { PACOTES, type PacoteDeFunil } from "@/lib/onboarding/pacotes-de-funil";
import {
  garantirQuadroComoPadrao,
  quadroJaServeOPacote,
} from "@/lib/onboarding/garantir-quadro";
import type { PropostaDeFunil } from "@/lib/onboarding/proposta-de-funil";
import { aplicarReadyModel } from "@/lib/ready-models/aplicar";
import { resolverDefinition, resolverIdDoModelo } from "@/lib/ready-models/catalogo";
import { idsDePerfilAceitos, CHAVE_PERFIL, lerPerfilDoNegocio } from "@/lib/ready-models/perfil";
import type { ReadyModelId, ReadyModelSubtype } from "@/lib/ready-models/tipos";

export { garantirQuadroComoPadrao, quadroJaServeOPacote };
export { CHAVE_PERFIL };

export const IDS_DE_PERFIL = idsDePerfilAceitos();
export type IdDePerfil = string;

export function pacoteDoPerfil(id: string): PacoteDeFunil | null {
  return PACOTES.find((p) => p.id === id) ?? null;
}

/** Lê o id gravado. Aceita alias antigo (locadora) e id novo (locacao). */
export function lerPerfilGravado(settings: unknown): IdDePerfil | null {
  const pronto = lerPerfilDoNegocio(settings);
  if (pronto) return pronto.id;
  if (!settings || typeof settings !== "object") return null;
  const bloco = (settings as Record<string, unknown>)[CHAVE_PERFIL];
  if (!bloco || typeof bloco !== "object") return null;
  const id = (bloco as { id?: unknown }).id;
  if (typeof id !== "string") return null;
  return pacoteDoPerfil(id)?.id ?? resolverIdDoModelo(id);
}

/** Quando settings ainda não tem a chave — o quadro padrão denuncia o perfil. */
export function inferirPerfilPeloNomeDoQuadro(nome: string | null | undefined): IdDePerfil | null {
  if (!nome) return null;
  return PACOTES.find((p) => p.proposta.nome === nome)?.id ?? null;
}

export type ResultadoDoPerfil = {
  perfil: ReadyModelId;
  pipelinePadraoId: string;
  criouQuadroNovo: boolean;
};

export async function aplicarPerfilDoNegocio(
  admin: SupabaseClient,
  orgId: string,
  id: string,
  extras?: {
    subtype?: ReadyModelSubtype | string | null;
    followup?: boolean;
    actorUserId?: string | null;
    pipelineOverride?: PropostaDeFunil;
  },
): Promise<ResultadoDoPerfil> {
  const definition = resolverDefinition(id, extras?.subtype);
  if (!definition) throw new Error(`perfil desconhecido: ${id}`);

  const r = await aplicarReadyModel(admin, orgId, definition, {
    followup: extras?.followup === true,
    noopSeJaAplicado: true,
    actorUserId: extras?.actorUserId ?? null,
    pipelineOverride: extras?.pipelineOverride,
  });
  return {
    perfil: r.perfil.id,
    pipelinePadraoId: r.pipelinePadraoId,
    criouQuadroNovo: r.criouQuadroNovo,
  };
}
