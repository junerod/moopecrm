/**
 * Liga ou ajusta um fluxo pronto do Pack — sem segundo motor.
 *
 * O grafo é o mesmo formato do Ready Model / lembrete de 24h.
 * Nasce rascunho no instalador; publicar é o clique do leigo.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { aplicarBusinessPack } from "@/lib/business-packs/aplicar";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { tituloDoTemplateDoFluxo } from "@/lib/business-packs/sementes";
import type { BusinessPackDefinition, PackArtifacts } from "@/lib/business-packs/tipos";
import { grafoDoFluxoPronto, quandoDoFluxo } from "@/lib/negocio/grafos-do-pack";
import { publishFollowupFlowVersion } from "@/lib/followup/publish";
import { validateFlowForPublish } from "@/lib/followup/validate-publish";

export const ajusteFluxoDoPackSchema = z
  .object({
    key: z.string().trim().min(1).max(64),
    mensagem: z.string().trim().min(1).max(1000).optional(),
    mensagem_2: z.string().trim().min(1).max(1000).optional(),
    ativo: z.boolean().optional(),
  })
  .strict();

export type AjusteFluxoDoPack = z.infer<typeof ajusteFluxoDoPackSchema>;

export type FluxoProntoCarregado = {
  key: string;
  name: string;
  description: string;
  quando: string;
  mensagem: string;
  mensagem2?: string;
  passos?: string[];
  como_usar?: string;
  destaque?: boolean;
  ativo: boolean;
};

export function montarFluxosNaTela(
  definition: BusinessPackDefinition,
  artifacts: PackArtifacts,
  pointers: Array<{ id: string; status: string | null }>,
  templates: Array<{ title: string | null; body: string | null }>,
): FluxoProntoCarregado[] {
  const porId = new Map(pointers.map((p) => [p.id, p]));
  const porTitulo = new Map(
    templates
      .filter((t) => typeof t.title === "string" && typeof t.body === "string")
      .map((t) => [t.title as string, t.body as string]),
  );
  return definition.followups.map((seed) => {
    const id = artifacts.followup_keys[seed.key];
    const pointer = id ? porId.get(id) : undefined;
    return {
      key: seed.key,
      name: seed.name,
      description: seed.description,
      quando: quandoDoFluxo(seed),
      mensagem: porTitulo.get(tituloDoTemplateDoFluxo(seed.key)) ?? seed.message,
      mensagem2: seed.message_2
        ? porTitulo.get(tituloDoTemplateDoFluxo(seed.key, 2)) ?? seed.message_2
        : undefined,
      passos: seed.passos,
      como_usar: seed.como_usar,
      destaque: seed.destaque,
      ativo: pointer?.status === "active",
    };
  });
}

async function lerSettings(admin: SupabaseClient, orgId: string): Promise<Record<string, unknown>> {
  const { data, error } = await admin
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(`ler settings: ${error.message}`);
  const raw = data?.settings;
  return raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
}

async function garantirTemplate(
  admin: SupabaseClient,
  orgId: string,
  actorUserId: string,
  key: string,
  mensagem: string,
  parte: 1 | 2 = 1,
): Promise<string> {
  const title = tituloDoTemplateDoFluxo(key, parte);
  const { data: existente, error: sel } = await admin
    .from("message_templates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("title", title)
    .maybeSingle();
  if (sel) throw new Error(`ler template do fluxo: ${sel.message}`);
  if (existente) {
    const { error: upd } = await admin
      .from("message_templates")
      .update({ body: mensagem } as never)
      .eq("id", existente.id)
      .eq("organization_id", orgId);
    if (upd) throw new Error(`atualizar template do fluxo: ${upd.message}`);
    return existente.id as string;
  }
  const { data: criado, error: ins } = await admin
    .from("message_templates")
    .insert({
      organization_id: orgId,
      owner_user_id: null,
      title,
      body: mensagem,
      created_by_user_id: actorUserId,
    } as never)
    .select("id")
    .single();
  if (ins || !criado) throw new Error(`criar template do fluxo: ${ins?.message ?? "sem id"}`);
  return criado.id as string;
}

export async function ativarFluxoDoPack(
  admin: SupabaseClient,
  orgId: string,
  actorUserId: string,
  opts: AjusteFluxoDoPack,
): Promise<{ id: string; key: string; ativo: boolean; mensagem: string }> {
  const settings = await lerSettings(admin, orgId);
  let pack = lerPackGravado(settings);
  if (!pack) throw new Error("Ative um modelo pronto antes de ligar um fluxo.");

  const definition = resolverPack(pack.id);
  if (!definition) throw new Error("Modelo do pack não encontrado.");
  const seed = definition.followups.find((f) => f.key === opts.key);
  if (!seed) throw new Error("Esse fluxo não existe neste modelo.");

  if (!pack.artifacts.followup_keys[opts.key]) {
    await aplicarBusinessPack(admin, orgId, pack.id, { actorUserId, soPreencherFaltantes: true });
    pack = lerPackGravado(await lerSettings(admin, orgId));
    if (!pack) throw new Error("Não consegui preparar o fluxo do modelo.");
  }

  const pointerId = pack.artifacts.followup_keys[opts.key];
  if (!pointerId) throw new Error("O fluxo ainda não foi preparado. Reaplique o modelo.");

  const { data: pointer, error: sel } = await admin
    .from("followup_flow_pointers")
    .select("id, status, trigger_config")
    .eq("organization_id", orgId)
    .eq("id", pointerId)
    .maybeSingle();
  if (sel) throw new Error(`ler fluxo: ${sel.message}`);
  if (!pointer) throw new Error("Fluxo não encontrado.");

  const { data: template } = await admin
    .from("message_templates")
    .select("body")
    .eq("organization_id", orgId)
    .eq("title", tituloDoTemplateDoFluxo(opts.key))
    .maybeSingle();
  const { data: template2 } = seed.message_2
    ? await admin
        .from("message_templates")
        .select("body")
        .eq("organization_id", orgId)
        .eq("title", tituloDoTemplateDoFluxo(opts.key, 2))
        .maybeSingle()
    : { data: null };
  const mensagem = opts.mensagem?.trim() || (typeof template?.body === "string" ? template.body : seed.message);
  const mensagem2 = seed.message_2
    ? opts.mensagem_2?.trim() ||
      (typeof template2?.body === "string" ? template2.body : seed.message_2)
    : undefined;
  const ligar = opts.ativo !== false;

  if (!ligar) {
    if (pointer.status !== "disabled") {
      const { error: upd } = await admin
        .from("followup_flow_pointers")
        .update({ status: "disabled" } as never)
        .eq("id", pointerId)
        .eq("organization_id", orgId);
      if (upd) throw new Error(`desligar fluxo: ${upd.message}`);
    }
    return { id: pointerId, key: opts.key, ativo: false, mensagem };
  }

  const templateId = await garantirTemplate(admin, orgId, actorUserId, opts.key, mensagem);
  const segundoId = mensagem2
    ? await garantirTemplate(admin, orgId, actorUserId, opts.key, mensagem2, 2)
    : undefined;
  const etapaId = etapaDoTrigger(pointer.trigger_config);
  const graph = grafoDoFluxoPronto(seed, { primeira: templateId, segunda: segundoId }, etapaId);
  const validacao = validateFlowForPublish(graph);
  if (!validacao.ok) {
    throw new Error(`grafo do fluxo inválido: ${validacao.errors.map((e) => e.code).join(",")}`);
  }

  const { error: prep } = await admin
    .from("followup_flow_pointers")
    .update({ draft_graph: graph } as never)
    .eq("id", pointerId)
    .eq("organization_id", orgId);
  if (prep) throw new Error(`preparar fluxo: ${prep.message}`);

  const pub = await publishFollowupFlowVersion(admin, {
    orgId,
    pointerId,
    graph,
    createdBy: actorUserId,
  });
  if (!pub.ok) throw new Error(`publicar fluxo: ${pub.message}`);
  return { id: pointerId, key: opts.key, ativo: true, mensagem };
}

function etapaDoTrigger(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const params = (raw as { params?: unknown }).params;
  if (!params || typeof params !== "object") return null;
  const id = (params as { stage_id?: unknown }).stage_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}
