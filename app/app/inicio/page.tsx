import { redirect } from "next/navigation";

import { ChecklistPrimeirosPassos } from "@/components/negocio/ChecklistPrimeirosPassos";
import { HojeOperacional } from "@/components/negocio/HojeOperacional";
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
        <p className="text-sm text-muted-foreground">
          {estado.empresa}
          {estado.modeloRotulo !== "Não definido"
            ? ` · ${estado.modeloRotulo}${estado.subtipo ? ` · ${estado.subtipo}` : ""}`
            : ""}
        </p>
      </header>

      {!completo ? (
        <ChecklistPrimeirosPassos itens={estado.checklist} recolhidoInicial />
      ) : null}

      <HojeOperacional />
    </div>
  );
}
