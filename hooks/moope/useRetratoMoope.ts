"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { RetratoComercial } from "@/lib/moope/retrato-comercial";

export interface RetratoMoopePayload {
  disponivel: boolean;
  fonte?: "live" | "cache";
  retrato?: RetratoComercial;
  motivo?: string;
  mensagem?: string;
}

export function useRetratoMoope(contactId: string | null) {
  return useQuery({
    queryKey: ["moope-retrato", contactId],
    enabled: !!contactId,
    queryFn: () =>
      apiClient
        .get<{ data: RetratoMoopePayload }>(`/api/v1/contacts/${contactId}/moope-retrato`)
        .then((r) => r.data),
    staleTime: 30_000,
    retry: false,
  });
}
