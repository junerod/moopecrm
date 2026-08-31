import Link from "next/link";

import { NavHub } from "@/components/shell/NavHub";
import { Card } from "@/components/ui/card";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { PORTA_DA_PLATAFORMA } from "@/lib/navigation/porta-da-plataforma";
import { ShieldCheck } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";

/**
 * Hub de Organização.
 *
 * A lista de cards que vivia aqui era uma segunda navegação escrita à mão, e
 * divergia do sidebar — Funis, Conexões e Audit Log apareciam como se fossem
 * configuração, quando são CRM, Canais e Análise. Agora o conteúdo vem do
 * registro, e o que sobra aqui é o que de fato é organização: sua conta, sua
 * empresa, e quem tem acesso ao quê.
 *
 * O card-ponte para "Canal oficial (Meta) e templates" que a `main` manteve
 * aqui NÃO foi perdido no merge — ele foi promovido. A ponte existia porque
 * conectar canal tinha duas respostas dependendo do WhatsApp, e quem já sabia
 * procurar em Configurações precisava continuar achando. Com o registro, o
 * grupo CANAIS fica visível no sidebar para todo admin e o ⌘K acha "canal
 * oficial" por nome — a pergunta passa a ter um lugar só, que é o que a ponte
 * tentava ensinar apontando para outro.
 */
export default async function SettingsHubPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);

  return (
    <NavHub
      group="organizacao"
      isPlatformAdmin={user.is_platform_admin}
      role={activeOrg?.role ?? null}
      title="Configurações"
      subtitle="Sua conta, os dados da empresa e quem tem acesso ao quê."
    >
      {user.is_platform_admin ? (
        <section aria-labelledby="hub-instalacao" className="space-y-3">
          <h2
            id="hub-instalacao"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground/70"
          >
            Instalação
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <Link href={PORTA_DA_PLATAFORMA.href} className="block">
              <Card className="flex h-full gap-3 p-4 transition-colors hover:border-border-strong">
                <ShieldCheck
                  size={20}
                  weight="regular"
                  aria-hidden
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
                <div>
                  <h3 className="text-sm font-semibold">{PORTA_DA_PLATAFORMA.label}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {PORTA_DA_PLATAFORMA.description}
                  </p>
                </div>
              </Card>
            </Link>
          </div>
        </section>
      ) : null}
    </NavHub>
  );
}
