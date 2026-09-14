"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export function useAbrirConversaComContato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      channel_session_id: string;
      contact_id?: string;
      phone_number?: string;
      name?: string;
    }) =>
      apiClient
        .post<{ data: { conversation_id: string; contact_id: string } }>(
          "/api/v1/conversations/open-with-contact",
          body,
        )
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
