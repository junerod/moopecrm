import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { detalhesDoPack, packEstaAtivo } from "@/lib/business-packs/apresentacao";
import { catalogoAmigavel } from "@/lib/business-packs/capacidades";
import { catalogoDePacks, resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { carregarConexaoLocadora, urlDaApiDaLocadora } from "@/lib/moope/cliente-locadora";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Car } from "@/lib/ui/icons";
import { AppIcon } from "@/components/ds/AppIcon";

import { ModelosProntosClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modelos prontos" };

export default async function ModelosProntosPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("settings, display_name")
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const instalado = lerPackGravado(org?.settings);
  const definition =
    (instalado ? resolverPack(instalado.id) : null) ?? resolverPack("locadora_veiculos");
  const detalhes = definition ? detalhesDoPack(definition) : null;

  const { data: funil } = await supabase
    .from("crm_pipelines")
    .select("id, name")
    .eq("organization_id", activeOrg.orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();

  const admin = createAdminClient();
  let gestao: "configurado" | "nao_disponivel" | "conectar" = "conectar";
  try {
    const conexao = await carregarConexaoLocadora(admin, activeOrg.orgId);
    gestao = conexao && urlDaApiDaLocadora(conexao) ? "configurado" : "conectar";
  } catch {
    gestao = "nao_disponivel";
  }

  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const aiMode = typeof settings.ai_mode === "string" ? settings.ai_mode : "off";

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        icon={<AppIcon icon={Car} />}
        titulo="Modelos prontos"
        descricao="Veja os 6 assistentes, o funil e o que liga ou não. Depois ative ou desative o conjunto."
      />
      <ModelosProntosClient
        podeInstalar={
          user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin
        }
        catalogo={catalogoDePacks()}
        instalado={instalado}
        packAtivo={packEstaAtivo(instalado)}
        funilNome={funil?.name ?? definition?.pipeline.nome ?? null}
        etapas={detalhes?.etapas ?? []}
        gestao={gestao}
        aiMode={aiMode}
        capacidades={definition ? catalogoAmigavel(definition.capabilities, gestao === "configurado") : []}
        assistentes={detalhes?.assistentes ?? []}
        colecoes={detalhes?.colecoes ?? []}
        automationsDef={detalhes?.automacoes ?? []}
        respostas={detalhes?.respostas ?? []}
        campanhas={detalhes?.campanhas ?? []}
      />
    </div>
  );
}
