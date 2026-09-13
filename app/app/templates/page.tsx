import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { FileText } from "@/lib/ui/icons";

import { TemplatesClient } from "./_components/TemplatesClient";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app/inbox");
  const canShare = ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      {/* "Respostas rápidas", não "Templates": estes são scripts do atendente,
          consumidos pelo composer do inbox. O nome "Templates" pertence aos da
          Meta (HSM), em Canais, onde é o termo técnico correto. Duas telas com
          o mesmo nome e propósitos opostos confundiam. A URL não muda. */}
      <PageHeader
        icon={<AppIcon icon={FileText} tone="blue" size="lg" />}
        titulo="Respostas rápidas"
        descricao="Scripts salvos para responder mais rápido; pessoais ou compartilhados com a equipe."
      />
      <TemplatesClient canShare={canShare} currentUserId={user.id} />
    </div>
  );
}
