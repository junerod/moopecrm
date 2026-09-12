"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { QueueStatus } from "@/lib/routing/queue";

export function useQueueStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["conversations", "queue-status"],
    enabled,
    queryFn: async () => {
      const res = await apiClient.get<{ data: QueueStatus }>("/api/v1/conversations/queue-status");
      return res.data;
    },
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}
