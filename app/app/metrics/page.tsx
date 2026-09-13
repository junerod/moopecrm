import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { ChartBar } from "@/lib/ui/icons";

import { MetricsClient } from "./_components/MetricsClient";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  // spec 13 §6.1: agent vê as próprias (RLS); a comparação por atendente é manager+.
  const canCompare = !!activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={ChartBar} tone="blue" size="lg" />}
        titulo="Desempenho"
        descricao={
          canCompare
            ? "Fila, funil, próxima ação e campanhas. Escolha Hoje, 7 ou 30 dias."
            : "Atrito, seu funil e sua performance no período."
        }
      />

      <MetricsClient canCompare={canCompare} currentUserId={user.id} />
    </div>
  );
}
