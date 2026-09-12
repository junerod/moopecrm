import { redirect } from "next/navigation";

import { AtalhosDaOperacao } from "@/components/negocio/AtalhosDaOperacao";
import { CardDeSetupNegocio } from "@/components/negocio/CardDeSetup";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 p-6">
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
