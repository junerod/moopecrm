import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { garantirAgenteDoAcervo } from "@/lib/negocio/garantir-acervo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { SourceRow } from "@/hooks/ai/useKnowledgeSources";
import { ConhecimentoDaEmpresaClient } from "./_empresa";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conhecimento da Empresa" };

export default async function KnowledgeSourcesPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const supabase = await createClient();
  let { data: agent } = await supabase
    .from("ai_agents")
    .select("id, name, is_default")
    .eq("organization_id", activeOrg.orgId)
    .is("archived_at", null)
    .eq("is_default", true)
    .maybeSingle();

  if (!agent) {
    const { data: qualquer } = await supabase
      .from("ai_agents")
      .select("id, name, is_default")
      .eq("organization_id", activeOrg.orgId)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    agent = qualquer;
  }

  if (!agent) {
    const criado = await garantirAgenteDoAcervo(
      createAdminClient(),
      activeOrg.orgId,
      user.id,
    );
    agent = { id: criado.id, name: "Assistente da empresa", is_default: true };
  }

  const { data: sourcesRaw } = await supabase
    .from("ai_knowledge_sources")
    .select("*")
    .eq("organization_id", activeOrg.orgId)
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: true });

  const initialSources = (sourcesRaw ?? []) as unknown as SourceRow[];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Conhecimento da Empresa</h1>
        <p className="text-sm text-muted-foreground">
          Ensine o sistema sobre sua empresa. O assistente e as sugestões de
          resposta consultam isto — não inventam o que não estiver aqui.
        </p>
      </header>

      <ConhecimentoDaEmpresaClient agentId={agent.id} initialSources={initialSources} />

      <p className="text-xs text-muted-foreground">
        Precisa de um assistente publicado?{" "}
        <Link href="/app/ai/agents" className="underline">
          Abrir assistentes
        </Link>
      </p>
      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/app/settings/business">Voltar para Meu Negócio</Link>
      </Button>
    </div>
  );
}
