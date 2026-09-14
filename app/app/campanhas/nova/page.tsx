import { PageHeader } from "@/components/ds/PageHeader";
import { AppIcon } from "@/components/ds/AppIcon";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { Megaphone } from "@/lib/ui/icons";
import { redirect } from "next/navigation";

import { NovaCampanhaClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function NovaCampanhaPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  const podeEnviar = !!org && ROLE_RANK[org.role] >= ROLE_RANK.manager;
  if (!podeEnviar) redirect("/app/campanhas");

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={Megaphone} tone="violet" size="lg" />}
        titulo="Criar campanha"
        descricao="Escolha o público certo, veja a mensagem como o contato vê, e só então dispare."
      />
      <NovaCampanhaClient />
    </div>
  );
}
