"use client";
import { Button } from "@/components/ui/button";
import { useClaimConversation } from "@/hooks/inbox/useClaimConversation";

export function CollisionBanner({
  conversationId,
  expectedAssignee,
  nome,
}: {
  conversationId: string;
  expectedAssignee: string;
  nome: string;
}) {
  const claim = useClaimConversation();
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-300 bg-amber-50/70 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-950/30"
      data-testid="collision-banner"
      role="status"
    >
      <p className="text-xs text-amber-950 dark:text-amber-100">
        {nome} está atendendo esta conversa.
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        disabled={claim.isPending}
        data-testid="collision-assumir"
        onClick={() =>
          claim.mutate({
            conversation_id: conversationId,
            expected_assignee: expectedAssignee,
          })
        }
      >
        {claim.isPending ? "Assumindo…" : "Assumir atendimento"}
      </Button>
    </div>
  );
}
