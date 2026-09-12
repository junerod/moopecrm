import { redirect } from "next/navigation";

import { HomeDashboard } from "@/components/home/HomeDashboard";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { carregarEstadoDoSetup } from "@/lib/negocio/estado";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Início" };

export default async function InicioPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  const estado = await carregarEstadoDoSetup(await createClient(), activeOrg.orgId);
  const completo = estado.checklist.every((i) => i.feito);

  return (
    <HomeDashboard
      nome={user.full_name}
      empresa={estado.empresa}
      subtitulo={
        estado.modeloRotulo !== "Não definido"
          ? `${estado.modeloRotulo}${estado.subtipo ? ` · ${estado.subtipo}` : ""}`
          : undefined
      }
      setup={{ itens: estado.checklist, completo }}
    />
  );
}
