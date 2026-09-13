import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { ScalesSimple } from "@/lib/ui/icons";

import { RequestsTable } from "./RequestsTable";

export const dynamic = "force-dynamic";

export default async function LgpdRequestsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);

  if (!activeOrg) redirect("/app");

  // Permission: role >= admin OR platform_admin (lgpd:execute)
  const isAllowed =
    user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin;
  if (!isAllowed) redirect("/app");

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={ScalesSimple} tone="indigo" size="lg" />}
        titulo="Solicitações LGPD"
        descricao="Anonimizações e solicitações de dados de titulares. Apenas admins."
      />
      <RequestsTable />
    </div>
  );
}
