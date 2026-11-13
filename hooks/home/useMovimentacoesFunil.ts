"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { MovimentacaoDoFunil } from "@/lib/home/movimentacoes-funil";

export function useMovimentacoesFunil() {
  return useQuery({
    queryKey: ["funil", "movimentacoes"],
    queryFn: () =>
      apiClient
        .get<{ data: MovimentacaoDoFunil[] }>("/api/v1/leads/movimentacoes")
        .then((r) => r.data),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}
