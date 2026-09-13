"use client";
import { AgentEditor } from "@/components/ai/AgentEditor";
import type { AgentRow } from "@/hooks/ai/useAgent";
import type { CapacidadeAmigavel } from "@/lib/business-packs/capacidades";

interface Props {
  agentId: string;
  initialData: AgentRow;
  readOnly?: boolean;
  papel?: string | null;
  capacidades?: CapacidadeAmigavel[];
  aiMode?: string;
}

export function AgentEditorClient({
  agentId,
  initialData,
  readOnly,
  papel,
  capacidades,
  aiMode,
}: Props) {
  return (
    <AgentEditor
      agentId={agentId}
      initialData={initialData}
      readOnly={readOnly}
      papel={papel}
      capacidades={capacidades}
      aiMode={aiMode}
    />
  );
}
