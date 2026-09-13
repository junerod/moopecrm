import Link from "next/link";
import { redirect } from "next/navigation";

import { AppIcon } from "@/components/ds/AppIcon";
import { PageHeader } from "@/components/ds/PageHeader";
import { Button } from "@/components/ui/button";
import type { SourceRow } from "@/hooks/ai/useKnowledgeSources";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { metadadoPublicoDaFonte } from "@/lib/ai/knowledge/metadado-publico";
import { garantirAgenteDoAcervo } from "@/lib/negocio/garantir-acervo";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BookOpen } from "@/lib/ui/icons";

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

  const initialSources = ((sourcesRaw ?? []) as unknown as SourceRow[]).map((s) => ({
    ...s,
    source_metadata: metadadoPublicoDaFonte(s.source_metadata),
  }));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 bg-[var(--color-bg)] p-6">
      <PageHeader
        icon={<AppIcon icon={BookOpen} tone="amber" size="lg" />}
        titulo="Conhecimento da Empresa"
        descricao="Ensine a MOOPE sobre sua empresa para que assistentes e sugestões respondam usando informações reais."
      />

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
