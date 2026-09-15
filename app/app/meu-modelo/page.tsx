import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { LinkDoManual } from "@/components/manual/LinkDoManual";
import { AtalhoDoManual } from "@/components/negocio/AtalhoDoManual";
import { Button } from "@/components/ui/button";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { packEstaAtivo, resumoDoPack } from "@/lib/business-packs/apresentacao";
import { carregarChecklistDoPack } from "@/lib/business-packs/checklist";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { createClient } from "@/lib/supabase/server";
import { Storefront } from "@/lib/ui/icons";

import { MeuModeloClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu modelo" };

export default async function MeuModeloPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).maybeSingle();
  const pack = lerPackGravado(org?.settings);
  if (!pack || !packEstaAtivo(pack)) redirect("/app/modelos-prontos");

  const definition = resolverPack(pack.id);
  if (!definition) redirect("/app/modelos-prontos");

  const checklist = await carregarChecklistDoPack(supabase, activeOrg.orgId);
  if (!checklist) redirect("/app/modelos-prontos");

  const resumo = resumoDoPack(definition);
  const agentIds = Object.values(pack.artifacts.agent_keys);
  const autoIds = Object.values(pack.artifacts.automation_keys);

  const [agentes, fontes, autos] = await Promise.all([
    agentIds.length
      ? supabase
          .from("ai_agents")
          .select("id, published_version_id")
          .eq("organization_id", activeOrg.orgId)
          .in("id", agentIds)
          .is("archived_at", null)
      : Promise.resolve({ data: [] as Array<{ published_version_id: string | null }> }),
    supabase
      .from("ai_knowledge_sources")
      .select("id, is_active, status")
      .eq("organization_id", activeOrg.orgId),
    autoIds.length
      ? supabase.from("automation_rules").select("id, is_active").eq("organization_id", activeOrg.orgId).in("id", autoIds)
      : Promise.resolve({ data: [] as Array<{ is_active: boolean | null }> }),
  ]);

  const configurados = agentes.data?.length ?? 0;
  const publicados = (agentes.data ?? []).filter((a) => Boolean(a.published_version_id)).length;
  const materiais = (fontes.data ?? []).filter((f) => f.is_active !== false && (f.status ?? "ready") !== "archived").length;
  const ativas = (autos.data ?? []).filter((a) => a.is_active === true).length;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        icon={<AppIcon icon={Storefront} />}
        titulo="Meu modelo"
        descricao="Termine a configuração. O dia a dia fica nas telas de operação."
        acoes={
          <Suspense fallback={null}>
            <Button asChild variant="outline" size="sm">
              <LinkDoManual capitulo="modelos-prontos">Como usar</LinkDoManual>
            </Button>
          </Suspense>
        }
      />
      <Suspense fallback={null}>
        <AtalhoDoManual
          testid="hub-abrir-manual"
          titulo="Como terminar a configuração"
          texto="WhatsApp, material, publicar assistentes e a primeira automação — passo a passo."
        />
      </Suspense>
      <MeuModeloClient
        packId={pack.id}
        packLabel={definition.label}
        checklist={checklist}
        podeInstalar={user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin}
        cards={[
          {
            titulo: "Assistentes",
            linhas: [`${configurados} configurados`, `${publicados} publicados`],
            href: "/app/ai/agents",
            cta: "Configurar",
            testid: "hub-card-assistentes",
          },
          {
            titulo: "Funil",
            linhas: [definition.pipeline.nome, `${resumo.etapas} etapas`],
            href: "/app/kanban",
            cta: "Abrir quadro",
            testid: "hub-card-funil",
          },
          {
            titulo: "Conhecimento",
            linhas: [`${materiais} materiais`, `${resumo.colecoes} pastas`],
            href: "/app/ai/knowledge/sources",
            cta: "Adicionar material",
            testid: "hub-card-conhecimento",
          },
          {
            titulo: "Automações",
            linhas: [`${ativas} ativas`, `${resumo.automacoes} disponíveis`],
            href: "/app/ai/followups",
            cta: "Configurar",
            testid: "hub-card-automacoes",
          },
          {
            titulo: "Campanhas",
            linhas: [`${resumo.campanhas} modelos`],
            href: "/app/campanhas/nova",
            cta: "Criar campanha",
            testid: "hub-card-campanhas",
          },
          {
            titulo: "Respostas rápidas",
            linhas: [`${resumo.respostas} modelos`],
            href: "/app/templates",
            cta: "Gerenciar",
            testid: "hub-card-respostas",
          },
        ]}
      />
    </div>
  );
}
