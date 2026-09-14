import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { AtalhoDoManual } from "@/components/negocio/AtalhoDoManual";
import { Button } from "@/components/ui/button";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { detalhesDoPack, packEstaAtivo } from "@/lib/business-packs/apresentacao";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { ehBusinessPackId, lerPackGravado } from "@/lib/business-packs/perfil";
import { createClient } from "@/lib/supabase/server";
import { Storefront } from "@/lib/ui/icons";

import { DetalheDoModeloClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function DetalheDoModeloPage({
  params,
}: {
  params: Promise<{ packId: string }>;
}) {
  const { packId } = await params;
  if (!ehBusinessPackId(packId)) notFound();
  const definition = resolverPack(packId);
  if (!definition) notFound();

  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).maybeSingle();
  const instalado = lerPackGravado(org?.settings);
  const detalhes = detalhesDoPack(definition);

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        icon={<AppIcon icon={Storefront} />}
        titulo="Modelo pronto"
        descricao="Veja o que entra antes de ativar."
        acoes={
          <Button asChild variant="outline" size="sm">
            <Link href="/app/manual#modelos-prontos">Como usar</Link>
          </Button>
        }
      />
      <AtalhoDoManual
        testid="detalhe-abrir-manual"
        titulo="Como ativar sem se perder"
        texto="Loja escolhe. Meu modelo configura. Assistentes e Funil são o trabalho."
      />
      <DetalheDoModeloClient
        packId={definition.id}
        label={definition.label}
        description={definition.description}
        funilNome={definition.pipeline.nome}
        etapas={detalhes.etapas}
        assistentes={detalhes.assistentes}
        colecoes={detalhes.colecoes}
        automacoes={detalhes.automacoes}
        respostas={detalhes.respostas}
        campanhas={detalhes.campanhas}
        podeInstalar={user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin}
        jaAtivo={packEstaAtivo(instalado) && instalado?.id === definition.id}
      />
    </div>
  );
}
