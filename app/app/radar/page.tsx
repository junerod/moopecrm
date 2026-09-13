import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ClockCountdown } from "@/lib/ui/icons";

import { RiskRadarList } from "./_components/RiskRadarList";

export const dynamic = "force-dynamic";

export default async function RadarPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={ClockCountdown} tone="indigo" size="lg" />}
        titulo="Radar de risco"
        descricao="Demandas abertas que esfriaram e precisam de você. Se o assistente já agendou um retorno, aparece como “em voo”; sem próximo passo, é risco de perder o cliente."
      />
      <RiskRadarList />
    </div>
  );
}
