import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { lerAiMode } from "@/lib/ai/execucao/modos";
import { listSelectableChannels } from "@/lib/channels/selectable";
import { createClient } from "@/lib/supabase/server";
import { AssistenteSimplesForm } from "./_client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo assistente" };

export default async function AssistenteSimplesPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) redirect("/403");

  const supabase = await createClient();
  const [canais, org] = await Promise.all([
    listSelectableChannels(supabase, activeOrg.orgId),
    supabase.from("organizations").select("settings").eq("id", activeOrg.orgId).maybeSingle(),
  ]);
  const working = canais.find(
    (c) => (c.status ?? "").toUpperCase() === "WORKING" && (c.phone_number ?? "").trim(),
  );
  const settings = org.data?.settings as { ai_mode?: unknown } | null;

  return (
    <div className="flex flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Novo assistente</h1>
        <p className="text-sm text-muted-foreground">
          Criar não é ativar. O assistente nasce como rascunho.
        </p>
      </header>
      <AssistenteSimplesForm
        channelSessionId={working?.id ?? canais[0]?.id ?? null}
        aiMode={lerAiMode(settings?.ai_mode ?? "off")}
      />
    </div>
  );
}
