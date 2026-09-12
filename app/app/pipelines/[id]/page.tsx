import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lerInboundPipelineId } from "@/lib/leads/funil-de-nascimento";
import { PipelinePageClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: pipeline } = await supabase
    .from("crm_pipelines")
    .select("id, name, vocabulary, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!pipeline) notFound();
  const { data: irmaos } = await supabase
    .from("crm_pipelines")
    .select("id, name, is_default")
    .eq("organization_id", pipeline.organization_id)
    .eq("is_archived", false)
    .order("position");
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", pipeline.organization_id)
    .maybeSingle();
  return (
    <PipelinePageClient
      pipelineId={id}
      initialName={pipeline.name}
      funis={(irmaos ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        is_default: f.is_default,
      }))}
      inboundPipelineId={lerInboundPipelineId(org?.settings)}
    />
  );
}
