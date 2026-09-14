import { redirect } from "next/navigation";

import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { ChecklistPosAtivacao } from "@/components/negocio/ChecklistPosAtivacao";
import { detalhesDoPack, montarLojaDePacks, packEstaAtivo } from "@/lib/business-packs/apresentacao";
import { carregarChecklistDoPack } from "@/lib/business-packs/checklist";
import { catalogoAmigavel } from "@/lib/business-packs/capacidades";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { carregarConexaoLocadora, urlDaApiDaLocadora } from "@/lib/moope/cliente-locadora";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Storefront } from "@/lib/ui/icons";
import { AppIcon } from "@/components/ds/AppIcon";

import { ModelosProntosClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modelos prontos" };

export default async function ModelosProntosPage({
  searchParams,
}: {
  searchParams?: Promise<{ pack?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
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
  const pedido = typeof query.pack === "string" ? resolverPack(query.pack) : null;
  const definition =
    pedido ??
    (instalado ? resolverPack(instalado.id) : null) ??
    resolverPack("locadora_veiculos");
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
  const precisaGestao = Boolean(definition?.capabilities.some((c) => c.tool_id?.startsWith("moope_")));
  if (!precisaGestao) gestao = "nao_disponivel";
  const checklist = await carregarChecklistDoPack(supabase, activeOrg.orgId);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        icon={<AppIcon icon={Storefront} />}
        titulo="Modelos prontos"
        descricao="Escolha o modelo do seu negócio e ative. Assistentes, funil, respostas e automações entram prontos — você só ajusta depois."
      />
      {checklist ? <ChecklistPosAtivacao checklist={checklist} /> : null}
      <ModelosProntosClient
        packLabel={definition?.label ?? "Modelo pronto"}
        packDescricao={definition?.description ?? ""}
        packAjudaTitulo={`Como usar o modelo ${definition?.label ?? ""}`.trim()}
        packAjudaTexto="Ative o modelo, conclua os quatro passos do card Prepare sua empresa e comece a atender. Não manda mensagem sozinha. Automações nascem desligadas."
        packAlvoId={definition?.id ?? "locadora_veiculos"}
        packAjudaPassos={[
          "Ative o modelo nesta tela (administrador).",
          "Conclua os quatro passos: WhatsApp, conhecimento, publicar assistentes e uma automação.",
          "Conecte o WhatsApp.",
          "Coloque nas pastas o material da própria empresa.",
          "Publique os assistentes. Sem publicar, eles não atendem.",
          "Ligue uma automação só quando o texto estiver certo.",
        ]}
        podeInstalar={
          user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin
        }
        loja={montarLojaDePacks()}
        instalado={instalado}
        packAtivo={packEstaAtivo(instalado)}
        funilNome={definition?.pipeline.nome ?? null}
        funilAtualDaEmpresa={funil?.name ?? null}
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
