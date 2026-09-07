import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import {
  inferirPerfilPeloNomeDoQuadro,
  lerPerfilGravado,
} from "@/lib/onboarding/aplicar-perfil";
import { lerPerfilDoNegocio } from "@/lib/ready-models/perfil";
import { createClient } from "@/lib/supabase/server";
import { PerfilDoNegocioForm } from "./_client";

export const metadata = { title: "Perfil do negócio" };
export const dynamic = "force-dynamic";

export default async function PerfilDoNegocioPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();
  const { data: padrao } = await supabase
    .from("crm_pipelines")
    .select("name")
    .eq("organization_id", activeOrg.orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();
  const atual =
    lerPerfilGravado(data?.settings) ??
    inferirPerfilPeloNomeDoQuadro((padrao as { name?: string } | null)?.name);

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Perfil do negócio</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Escolhe o quadro padrão desta organização. Trocar não apaga
          negócios, conversas nem contatos.
        </p>
      </header>
      <PerfilDoNegocioForm
        atual={lerPerfilDoNegocio(data?.settings)?.id ?? atual}
        subtypeAtual={lerPerfilDoNegocio(data?.settings)?.subtype}
      />
    </div>
  );
}
