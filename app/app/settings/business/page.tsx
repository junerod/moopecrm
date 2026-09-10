import Link from "next/link";
import { redirect } from "next/navigation";

import { CardDeSetupNegocio } from "@/components/negocio/CardDeSetup";
import { AtalhosDaOperacao } from "@/components/negocio/AtalhosDaOperacao";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { carregarEstadoDoSetup } from "@/lib/negocio/estado";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu Negócio" };

export default async function MeuNegocioPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  const estado = await carregarEstadoDoSetup(await createClient(), activeOrg.orgId);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Meu Negócio</h1>
        <p className="text-sm text-muted-foreground">
          Central da configuração. A operação do dia a dia continua no Inbox e
          nos Leads.
        </p>
      </header>

      <section
        className="rounded-lg border border-border p-4"
        data-testid="perfil-do-negocio-resumo"
      >
        <h2 className="text-sm font-semibold">Perfil do negócio</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Empresa</dt>
            <dd data-testid="negocio-empresa">{estado.empresa}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Tipo de negócio</dt>
            <dd data-testid="negocio-tipo">{estado.modeloRotulo}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Subtipo</dt>
            <dd data-testid="negocio-subtipo">{estado.subtipo ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Modelo ativo</dt>
            <dd data-testid="negocio-modelo">{estado.modeloRotulo}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Alterar o modelo ajusta configurações sugeridas. Seus negócios e leads
          existentes não serão apagados.
        </p>
        <Link
          href="/app/settings/perfil"
          className="mt-2 inline-block text-sm font-medium underline"
        >
          Alterar modelo
        </Link>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {estado.cards.map((card) => (
          <CardDeSetupNegocio key={card.id} card={card} />
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Ir para o dia a dia</h2>
        <AtalhosDaOperacao />
      </div>
    </div>
  );
}
