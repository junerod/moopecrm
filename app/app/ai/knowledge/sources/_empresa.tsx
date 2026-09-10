"use client";

import { useRouter } from "next/navigation";

import { AdicionarConhecimento } from "@/components/negocio/AdicionarConhecimento";
import { TestarConhecimento } from "@/components/negocio/TestarConhecimento";
import type { SourceRow } from "@/hooks/ai/useKnowledgeSources";
import { KnowledgeSourcesClient } from "./_client";

export function ConhecimentoDaEmpresaClient({
  agentId,
  initialSources,
}: {
  agentId: string;
  initialSources: SourceRow[];
}) {
  const router = useRouter();
  return (
    <>
      <AdicionarConhecimento agentId={agentId} onCriada={() => router.refresh()} />
      <TestarConhecimento />
      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer text-sm font-medium">Fontes já cadastradas</summary>
        <div className="mt-4">
          <KnowledgeSourcesClient agentId={agentId} initialSources={initialSources} />
        </div>
      </details>
    </>
  );
}
