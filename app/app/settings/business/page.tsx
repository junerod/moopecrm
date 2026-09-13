import { redirect } from "next/navigation";

import { AtalhosDaOperacao } from "@/components/negocio/AtalhosDaOperacao";
import { CardDeSetupNegocio } from "@/components/negocio/CardDeSetup";
import { ModeloDoNegocio } from "@/components/negocio/ModeloDoNegocio";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { lerEmpresaDoSettings } from "@/lib/negocio/ficha";
import { carregarEstadoDoSetup } from "@/lib/negocio/estado";
import { createClient } from "@/lib/supabase/server";

import { FichaDaEmpresaForm } from "./_ficha";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu Negócio" };

export default async function MeuNegocioPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  const supabase = await createClient();
  const estado = await carregarEstadoDoSetup(supabase, activeOrg.orgId);
  const { data: org } = await supabase
    .from("organizations")
    .select("display_name, legal_name, cnpj, settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const podeEditar =
    user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin;
  const pendentes = estado.cards.filter((c) => c.estado !== "ok");
  const pack = lerPackGravado(org?.settings);
  const definition = pack ? resolverPack(pack.id) : null;
  const { count: assistentesConfigurados } = await supabase
    .from("ai_agents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", activeOrg.orgId)
    .is("archived_at", null);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 p-6">
      <ModeloDoNegocio
        pack={pack}
        definition={definition}
        assistentesConfigurados={assistentesConfigurados ?? 0}
        podeInstalar={podeEditar}
      />

      <FichaDaEmpresaForm
        displayName={(org?.display_name as string | null) ?? estado.empresa}
        legalName={(org?.legal_name as string | null) ?? estado.empresa}
        cnpj={(org?.cnpj as string | null) ?? null}
        contato={lerEmpresaDoSettings(org?.settings)}
        modeloRotulo={estado.modeloRotulo}
        subtipo={estado.subtipo}
        podeEditar={podeEditar}
      />

      {pendentes.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Ainda falta</h2>
          <div className="grid grid-cols-1 gap-3">
            {pendentes.map((card) => (
              <CardDeSetupNegocio key={card.id} card={card} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-2 border-t border-border pt-6">
        <h2 className="text-sm font-semibold">Ir para o dia a dia</h2>
        <AtalhosDaOperacao />
      </div>
    </div>
  );
}
