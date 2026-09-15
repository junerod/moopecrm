import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { Megaphone } from "@/lib/ui/icons";

import { CampanhasClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function CampanhasPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  const podeEnviar = !!org && ROLE_RANK[org.role] >= ROLE_RANK.manager;

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={Megaphone} tone="violet" size="lg" />}
        titulo="Campanhas"
        descricao="Recado para várias pessoas. Passo a passo no quadro abaixo e em Como usar."
      />
      <CampanhasClient podeEnviar={podeEnviar} />
    </div>
  );
}
