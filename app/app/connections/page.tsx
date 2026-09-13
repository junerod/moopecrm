import { redirect } from "next/navigation";

import { ConexoesShell } from "@/components/connections/ConexoesShell";
import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { PlugsConnected } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }

  const key = process.env.WAHA_API_KEY;
  const wahaConfigured = Boolean(
    process.env.WAHA_API_BASE_URL && key && key !== "dev_plaintext_change_me",
  );

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={PlugsConnected} tone="teal" size="lg" />}
        titulo="Conexões"
        descricao="Por onde seu negócio fala com o cliente. Conecte números por QR ou o número oficial da Meta, e acompanhe a saúde de cada um."
      />
      <ConexoesShell wahaConfigured={wahaConfigured} />
    </div>
  );
}
