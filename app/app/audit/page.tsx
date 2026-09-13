import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { ClockCounterClockwise } from "@/lib/ui/icons";

import { AuditClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={ClockCounterClockwise} tone="indigo" size="lg" />}
        titulo="Audit Log"
        descricao="Histórico append-only de mutações na organização. Manager+."
      />
      <AuditClient />
    </div>
  );
}
