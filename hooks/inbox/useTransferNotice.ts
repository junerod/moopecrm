"use client";
import { useCallback } from "react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/auth/AuthProvider";
import { useRealtimeChannel } from "@/hooks/realtime/useRealtimeChannel";

/**
 * Aviso de "conversa transferida para você" — sem tabela nova.
 * Reusa Realtime em `conversation_assignment_events` (já emitido no transfer).
 */
export function useTransferNotice() {
  const { user, activeOrg } = useAuth();
  const userId = user.id;
  const orgId = activeOrg?.orgId ?? null;

  const onChange = useCallback(
    (payload: unknown) => {
      if (!payload || typeof payload !== "object") return;
      const p = payload as {
        eventType?: string;
        new?: { reason?: string; to_user_id?: string | null; conversation_id?: string };
      };
      if (p.eventType !== "INSERT") return;
      const row = p.new;
      if (!row || row.reason !== "transfer" || row.to_user_id !== userId) return;
      toast.message("Conversa transferida para você.", {
        description: "Abra Minhas na Inbox para continuar o atendimento.",
        duration: 12_000,
      });
    },
    [userId],
  );

  useRealtimeChannel({
    name: orgId ? `transfer-notice-${orgId}` : "transfer-notice-off",
    postgresChanges: orgId
      ? {
          event: "INSERT",
          schema: "public",
          table: "conversation_assignment_events",
          filter: `organization_id=eq.${orgId}`,
        }
      : undefined,
    onChange,
    enabled: !!orgId,
  });
}
