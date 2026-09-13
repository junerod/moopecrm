import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
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
  const definition = instalado ? resolverPack(instalado.id) : null;

  const { data: agentes } = await supabase
    .from("ai_agents")
    .select("id, name, is_active, is_default, config")
    .eq("organization_id", activeOrg.orgId)
    .is("archived_at", null)
    .order("created_at");

  const { data: regras } = await supabase
    .from("automation_rules")
    .select("id, name, is_active")
    .eq("organization_id", activeOrg.orgId);

  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, title")
    .eq("organization_id", activeOrg.orgId);

  const { data: funil } = await supabase
    .from("crm_pipelines")
    .select("id, name")
    .eq("organization_id", activeOrg.orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();

  let etapas = 0;
  if (funil) {
    const { count } = await supabase
      .from("crm_stages")
      .select("id", { count: "exact", head: true })
      .eq("pipeline_id", funil.id)
      .eq("is_archived", false);
    etapas = count ?? 0;
  }

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
        descricao="Escolha, revise e ative. Sem precisar entender o motor por baixo."
      />
      <ModelosProntosClient
        podeInstalar={
          user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin
        }
        catalogo={catalogoDePacks()}
        instalado={instalado}
        definitionLabel={definition?.label ?? null}
        agentes={(agentes ?? []).map((a) => ({
          id: a.id,
          name: a.name,
          is_active: Boolean(a.is_active),
          is_default: Boolean(a.is_default),
        }))}
        automacoes={(regras ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          is_active: Boolean(r.is_active),
        }))}
        templates={(templates ?? []).map((t) => ({ id: t.id, title: t.title }))}
        funilNome={funil?.name ?? null}
        etapas={etapas}
        gestao={gestao}
        aiMode={aiMode}
        orgName={typeof org?.display_name === "string" ? org.display_name : "sua empresa"}
        capacidades={definition ? catalogoAmigavel(definition.capabilities, gestao === "configurado") : []}
        specialties={definition?.specialties.map((s) => ({ key: s.key, name: s.name })) ?? []}
        automationsDef={
          definition?.automations.map((a) => ({
            key: a.key,
            name: a.name,
            requires_gestao: Boolean(a.requires_gestao),
          })) ?? []
        }
      />
    </div>
  );
}
