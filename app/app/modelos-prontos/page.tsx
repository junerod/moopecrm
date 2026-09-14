import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { AtalhoDoManual } from "@/components/negocio/AtalhoDoManual";
import { Button } from "@/components/ui/button";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { montarLojaDePacks, packEstaAtivo } from "@/lib/business-packs/apresentacao";
import { carregarChecklistDoPack } from "@/lib/business-packs/checklist";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { createClient } from "@/lib/supabase/server";
import { Storefront } from "@/lib/ui/icons";

import { ModelosProntosClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modelos prontos" };

export default async function ModelosProntosPage({
  searchParams,
}: {
  searchParams?: Promise<{ pack?: string }>;
}) {
  const query = searchParams ? await searchParams : {};
  if (typeof query.pack === "string" && resolverPack(query.pack)) {
    redirect(`/app/modelos-prontos/${query.pack}`);
  }

  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).maybeSingle();
  const instalado = lerPackGravado(org?.settings);
  const checklist = await carregarChecklistDoPack(supabase, activeOrg.orgId);

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-6 overflow-y-auto p-6">
      <PageHeader
        icon={<AppIcon icon={Storefront} />}
        titulo="Modelos prontos"
        descricao="Escolha o tipo de operação da sua empresa."
        acoes={
          <Button asChild variant="outline" size="sm">
            <Link href="/app/manual#modelos-prontos">Como usar</Link>
          </Button>
        }
      />
      <AtalhoDoManual />
      <ModelosProntosClient
        loja={montarLojaDePacks()}
        instalado={instalado}
        packAtivo={packEstaAtivo(instalado)}
        podeInstalar={user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin}
        checklistProgresso={
          checklist
            ? {
                label: checklist.packLabel,
                concluidos: checklist.concluidos,
                total: checklist.total,
                pronto: checklist.pronto,
              }
            : null
        }
      />
    </div>
  );
}
