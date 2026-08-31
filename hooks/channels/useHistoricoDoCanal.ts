"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { ProgressoHistorico } from "@/lib/channels/historico-tipos";

export type { ProgressoHistorico };

export function useHistoricoDoCanal(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["channel-historico", sessionId],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: { historico: ProgressoHistorico | null; channel_status: string };
      }>(`/api/v1/channel-sessions/${sessionId}/historico`);
      return res.data;
    },
    enabled,
    staleTime: 5_000,
    refetchInterval: (q) => (q.state.data?.historico?.status === "rodando" ? 3_000 : false),
  });
}
