import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import type { FollowupFlowPointerRow } from "@/hooks/followup/useFollowupFlows";
import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ehFollowupDeSilencio,
  horasDoFollowup,
  TITULO_TEMPLATE_FOLLOWUP_24H,
} from "@/lib/negocio/followup-24h";
import { FlowArrow } from "@/lib/ui/icons";

import { FlowsList } from "./_components/FlowsList";
import { ProntasTab } from "./_components/ProntasTab";
import { QueueTab } from "./_components/QueueTab";

export const dynamic = "force-dynamic";

const FLOW_COLUMNS =
  "id, name, status, active_version_id, handoff_policy, trigger_config, updated_at";

export default async function FollowupFlowsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  // Fluxos (edição) segue exigindo manager+; a Fila (leitura) é de qualquer
  // member — o gate por tela fica dentro das abas (canWrite), não na rota.

  const supabase = await createClient();
  const { data } = await supabase
    .from("followup_flow_pointers")
    .select(FLOW_COLUMNS)
    .eq("organization_id", activeOrg.orgId)
    .order("updated_at", { ascending: false });

  const flows = (data ?? []) as unknown as FollowupFlowPointerRow[];
  const canWrite = ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;
  const silencio = flows.find((f) =>
    ehFollowupDeSilencio({
      name: f.name,
      status: f.status,
      trigger_config: (f as { trigger_config?: unknown }).trigger_config,
    }),
  );
  const silencioAtivo = silencio?.status === "active";
  const { data: templatePronto } = await supabase
    .from("message_templates")
    .select("body")
    .eq("organization_id", activeOrg.orgId)
    .eq("title", TITULO_TEMPLATE_FOLLOWUP_24H)
    .maybeSingle();
  const mensagemInicial =
    typeof templatePronto?.body === "string" ? templatePronto.body : undefined;
  const horasInicial = horasDoFollowup(
    (silencio as { trigger_config?: unknown } | undefined)?.trigger_config,
  );

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={FlowArrow} tone="cyan" size="lg" />}
        titulo="Automações"
        descricao="Recados e tarefas que o sistema faz sozinho. Se o cliente responder ou pedir para parar, o retorno para."
      />
      <Tabs defaultValue="minhas" className="flex flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="prontas">Prontas</TabsTrigger>
          <TabsTrigger value="minhas">Minhas automações</TabsTrigger>
          <TabsTrigger value="avancado">Avançado</TabsTrigger>
          <TabsTrigger value="fila">Fila</TabsTrigger>
        </TabsList>
        <TabsContent value="prontas">
          <ProntasTab
            jaAtivo={silencioAtivo}
            canWrite={canWrite}
            mensagemInicial={mensagemInicial}
            horasInicial={horasInicial}
          />
        </TabsContent>
        <TabsContent value="minhas">
          <FlowsList initialData={flows} canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="avancado">
          <p className="mb-3 text-sm text-muted-foreground">
            Editor visual e publicação — o construtor que já existia. Abrir um
            fluxo na lista leva ao quadro de etapas.
          </p>
          <FlowsList initialData={flows} canWrite={canWrite} />
        </TabsContent>
        <TabsContent value="fila">
          <QueueTab canWrite={canWrite} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
