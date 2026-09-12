"use client";
import { useAssignmentHistory } from "@/hooks/inbox/useAssignmentHistory";
import {
  formatarHoraDoAssignment,
  fraseDoAssignment,
} from "@/lib/inbox/historico-de-atendimento";

export function AssignmentHistory({ conversationId }: { conversationId: string }) {
  const { data, isLoading } = useAssignmentHistory(conversationId);
  const eventos = data ?? [];
  if (!isLoading && eventos.length === 0) return null;

  return (
    <details className="border-b border-border bg-muted/20 px-3 py-1.5 md:px-4" data-testid="assignment-history">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Histórico do atendimento
      </summary>
      <ul className="mt-1.5 space-y-1 pb-1">
        {eventos.map((e) => (
          <li key={e.id} className="text-xs text-muted-foreground">
            <span className="tabular-nums">{formatarHoraDoAssignment(e.created_at)}</span>
            {" · "}
            {fraseDoAssignment(e)}
          </li>
        ))}
      </ul>
    </details>
  );
}
