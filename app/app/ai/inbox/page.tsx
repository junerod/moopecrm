import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { Flag } from "@/lib/ui/icons";

import { AgentInboxList } from "./_components/AgentInboxList";

export const dynamic = "force-dynamic";

export default async function AgentInboxPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const canResolve = ROLE_RANK[activeOrg.role] >= ROLE_RANK.agent;

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={Flag} tone="violet" size="lg" />}
        titulo="Central de avisos"
        descricao="O que o assistente precisou escalar para o time: conexões caídas, tarefas que falharam, atendimentos passados a humanos."
      />
      <AgentInboxList canResolve={canResolve} />
    </div>
  );
}
