"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";

export interface DirectChannelState {
  connected: boolean;
  podeReceber: boolean;
  podeConectarComoApp: boolean;
  hasToken: boolean;
  accountId: string | null;
  displayName: string | null;
  status: string | null;
  webhook: { callbackUrl: string; verifyToken: string | null } | null;
}

export function useDirectChannel() {
  return useQuery({
    queryKey: ["direct-channel"],
    queryFn: async () => apiClient.get<{ data: DirectChannelState }>("/api/v1/channels/direct"),
    staleTime: 15_000,
  });
}

export function useConnectDirectChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { account_id: string; token?: string }) =>
      apiClient.post<{ data: { connected: boolean; displayName: string } }>(
        "/api/v1/channels/direct",
        input,
      ),
    onError: showApiError,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["direct-channel"] });
    },
  });
}
