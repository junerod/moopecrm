"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export interface AssignmentEventRow {
  id: string;
  conversation_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  changed_by: string | null;
  reason: string;
  created_at: string;
  from_user_name: string | null;
  to_user_name: string | null;
  changed_by_name: string | null;
}

export function useAssignmentHistory(conversationId: string | null) {
  return useQuery({
    queryKey: ["assignment-events", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await apiClient.get<{ data: AssignmentEventRow[] }>(
        `/api/v1/conversations/${conversationId}/assignment-events`,
      );
      return res.data;
    },
    staleTime: 15_000,
  });
}
