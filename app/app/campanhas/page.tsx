import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";

import { CampanhasClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function CampanhasPage() {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  const podeEnviar = !!org && ROLE_RANK[org.role] >= ROLE_RANK.manager;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
        <p className="text-sm text-muted-foreground">
          Disparo comercial essencial: segmento, mensagem, revisão e resultado.
        </p>
      </header>
      <CampanhasClient podeEnviar={podeEnviar} />
    </div>
  );
}
