import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import type { FollowupFlowPointerRow } from "@/hooks/followup/useFollowupFlows";
import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { packEstaAtivo } from "@/lib/business-packs/apresentacao";
import { resolverPack } from "@/lib/business-packs/catalogo";
import { lerPackGravado } from "@/lib/business-packs/perfil";
import { titulosDosTemplatesDoFluxo } from "@/lib/business-packs/sementes";
import { montarFluxosNaTela } from "@/lib/negocio/fluxos-do-pack";
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
  "id, name, status, active_version_id, handoff_policy, trigger_config, purpose, updated_at";

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

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .maybeSingle();
  const pack = lerPackGravado(orgRow?.settings);
  const definition = pack && packEstaAtivo(pack) ? resolverPack(pack.id) : null;
  let fluxosDoPack: ReturnType<typeof montarFluxosNaTela> = [];
  if (definition && pack) {
    const fluxoIds = Object.values(pack.artifacts.followup_keys);
    const titulos = definition.followups.flatMap((f) => titulosDosTemplatesDoFluxo(f));
    const [pointersPack, templatesPack] = await Promise.all([
      fluxoIds.length
        ? supabase
            .from("followup_flow_pointers")
            .select("id, status")
            .eq("organization_id", activeOrg.orgId)
            .in("id", fluxoIds)
        : Promise.resolve({ data: [] as Array<{ id: string; status: string | null }> }),
      titulos.length
        ? supabase
            .from("message_templates")
            .select("title, body")
            .eq("organization_id", activeOrg.orgId)
            .in("title", titulos)
        : Promise.resolve({ data: [] as Array<{ title: string | null; body: string | null }> }),
    ]);
    fluxosDoPack = montarFluxosNaTela(
      definition,
      pack.artifacts,
      pointersPack.data ?? [],
      templatesPack.data ?? [],
    );
  }

  return (
    <div className="flex h-full flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={FlowArrow} tone="cyan" size="lg" />}
        titulo="Bots"
        descricao="O que atende no WhatsApp e os recados que o sistema manda sozinho. Se o cliente responder ou pedir para parar, o retorno para."
      />
      <Tabs defaultValue={silencioAtivo ? "minhas" : "prontas"} className="flex flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="bots">Bots</TabsTrigger>
          <TabsTrigger value="prontas">Prontas</TabsTrigger>
          <TabsTrigger value="minhas">Recados</TabsTrigger>
          <TabsTrigger value="avancado">Avançado</TabsTrigger>
          <TabsTrigger value="fila">Fila</TabsTrigger>
        </TabsList>
        <TabsContent value="prontas">
          <ProntasTab
            jaAtivo={silencioAtivo}
            canWrite={canWrite}
            mensagemInicial={mensagemInicial}
            horasInicial={horasInicial}
            fluxosDoPack={fluxosDoPack}
          />
        </TabsContent>
        <TabsContent value="bots">
          <p className="mb-3 text-sm text-muted-foreground">
            Porta da frente no WhatsApp: menu numerado, FAQ, horário, humano ou
            assistente. Publicar não liga sozinho no número de outra pessoa —
            o rascunho do pack espera você.
          </p>
          <FlowsList initialData={flows} canWrite={canWrite} purpose="bot" />
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
